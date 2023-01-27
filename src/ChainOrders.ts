import Exchange from './exchanges/Exchange';
import Order, { ExecutedOrder, OrderSide, OrderStatus, OrderType, PrepareOrder, SimulateOrder } from './Order';
import OrderBook from './OrderBook';
import SafeMath from './util/SafeMath';

export class Simulation {
    avgPrice: number;
    receivedAssetAmount: number;
    inAssetAmount: number;
    totalTakerFee: number;
    simulationId: number;
    assetIn: string;
    quotePrice_InAsset_Divisor: boolean;
    orderBookExecutions: SimulateOrder[] = [];
}

class ChainOrders {
    private orderBooks: OrderBook[];
    //
    private simulations: Simulation[] = []; // [simulation][book][priceLevelOrder]
    public constructor(exchange: Exchange, orderBooks: OrderBook[]) {
        if (orderBooks.length <= 0) throw new Error('ChainOrder - constructor error - chain lenght <= 0');
        this.orderBooks = orderBooks;
    }

    public getSimulatedExecution(assetIn: string, amount: number = 0, quotePrice_InAsset_Divisor: boolean = true, onlyFirstPriceLevel: boolean = false): Simulation {
        let currentAsset = assetIn;
        let currentAmmount = amount;
        let avgPrice = 1;
        let simulationId = this.simulations.length;
        let currentSimulation: Simulation = new Simulation(); //[book][priceLevelOrder]
        //Unconditional - constructor gurantees orderbook.lenght > 0
        let startSide: OrderSide = this.orderBooks[0].getAsset1() == currentAsset ? OrderSide.SELL : OrderSide.BUY;
        let totalTakerFee = 0;
        for (let o of this.orderBooks) {
            if (o.getAsset1() == currentAsset) {
                //selling
                let obj = o.getSimulatedExecution(OrderSide.SELL, currentAmmount, onlyFirstPriceLevel);
                currentSimulation.orderBookExecutions.push(obj);
                if (startSide == OrderSide.SELL) avgPrice = SafeMath.mul(avgPrice, obj.avgPrice);
                else avgPrice = SafeMath.div(avgPrice, obj.avgPrice);
                currentAmmount = obj.receivedAssetAmount;
                currentAsset = o.getAsset2();
            } else if (o.getAsset2() == currentAsset) {
                //buying
                let obj = o.getSimulatedExecution(OrderSide.BUY, currentAmmount, onlyFirstPriceLevel);
                currentSimulation.orderBookExecutions.push(obj);
                if (startSide == OrderSide.BUY) avgPrice = SafeMath.mul(avgPrice, obj.avgPrice);
                else avgPrice = SafeMath.div(avgPrice, obj.avgPrice);
                currentAmmount = obj.receivedAssetAmount;
                currentAsset = o.getAsset1();
            } else throw new Error(`ChainOrders - incorrect chain - asset ${currentAsset} does not match asset1 ${o.getAsset1()} nor asset2 ${o.getAsset2()}`);
            totalTakerFee = SafeMath.add(totalTakerFee, o.getTakerFee());
        }
        //check should inverse
        if ((startSide == OrderSide.SELL && quotePrice_InAsset_Divisor) || (startSide == OrderSide.BUY && !quotePrice_InAsset_Divisor)) avgPrice = SafeMath.div(1, avgPrice);
        let inAssetAmount = quotePrice_InAsset_Divisor ? SafeMath.mul(currentAmmount, avgPrice) : SafeMath.div(currentAmmount, avgPrice);
        Object.assign(currentSimulation, { avgPrice, receivedAssetAmount: currentAmmount, inAssetAmount: inAssetAmount, totalTakerFee, simulationId, assetIn, quotePrice_InAsset_Divisor });
        this.simulations.push(currentSimulation);
        return currentSimulation;
    }
    /**
     * Tries to execute what was simulated with getSimulatedExecution - will stop in place if price changes more than slipage
     * @param slipageTolerance - eg. 0.005 to tolerate up to 0.5% slipage before canceling execution
     */
    public executeSimulation(
        simulationId: number,
        slipageTolerance: number
    ): Promise<{ receivedAmount: number; receivedAsset: string; remainingAssetAmout: number; remainingAsset: string; success: boolean }> {
        if (this.simulations.length <= simulationId) throw new Error('ChainOrders - executeSimulation - simulationId invalid');
        let simulation: Simulation = this.simulations[simulationId];
        return new Promise<{ receivedAmount: number; receivedAsset: string; remainingAssetAmout: number; remainingAsset: string; success: boolean }>(async (resolve, reject) => {
            let inAssetAmount = simulation.inAssetAmount;
            let obj: ExecutedOrder;
            let orderBook: OrderBook;
            let stopInPlace = () => {
                resolve({
                    receivedAmount: inAssetAmount,
                    receivedAsset: obj ? obj.receivedAsset : simulation.assetIn,
                    remainingAsset: obj ? obj.inAsset : '',
                    remainingAssetAmout: obj ? obj.remainingInAssetAmount : 0,
                    success: false,
                });
            };
            for (let i = 0; i < this.orderBooks.length; i++) {
                let simulatedOrdersExpected = simulation.orderBookExecutions[i];
                console.log(`Expected Simulation orderBook ${i}`, simulatedOrdersExpected);
                let simulatedOrdersActual = this.orderBooks[i].getSimulatedExecution(simulatedOrdersExpected.orders[0].side, inAssetAmount);
                console.log(`Simulated MAIN orderBook ${i}`, simulatedOrdersActual);
                let dummySlipageTolerance = SafeMath.sub(
                    slipageTolerance,
                    this.calculateSlipage(simulatedOrdersExpected.avgPrice, simulatedOrdersActual.avgPrice, simulatedOrdersExpected.orders[0].side)
                );
                console.log(`dummySlipageTolerance ${i} ::: ${dummySlipageTolerance}`);
                if (dummySlipageTolerance <= 0) {
                    return stopInPlace();
                }
                obj = await this.executePrepareOrders(simulatedOrdersActual.orders);
                console.log(`EXECUTE MAIN obj ${i} ::: ${obj}`);
                inAssetAmount = obj.receivedAssetAmount;
                slipageTolerance = SafeMath.sub(
                    slipageTolerance,
                    SafeMath.mul(
                        this.getAmountRation(simulatedOrdersExpected.receivedAssetAmount, obj.receivedAssetAmount),
                        this.calculateSlipage(simulatedOrdersExpected.avgPrice, obj.avgPrice, simulatedOrdersExpected.orders[0].side)
                    )
                );
                console.log(`slipageTolerance MAIN ${i} ::: ${slipageTolerance}`);
                console.log(`inAssetAmount MAIN ${i} ::: ${inAssetAmount}`);

                while (obj.remainingAmount) {
                    simulatedOrdersActual = this.orderBooks[i].getSimulatedExecution(simulatedOrdersExpected.orders[0].side, obj.remainingInAssetAmount);
                    console.log(`Simulated REMAINING orderBook ${i}`, simulatedOrdersActual);
                    dummySlipageTolerance = SafeMath.sub(
                        slipageTolerance,
                        this.calculateSlipage(simulatedOrdersExpected.avgPrice, simulatedOrdersActual.avgPrice, simulatedOrdersExpected.orders[0].side)
                    );
                    console.log(`dummySlipageTolerance ${i} ::: ${dummySlipageTolerance}`);

                    if (dummySlipageTolerance <= 0) {
                        return stopInPlace();
                    }
                    obj = await this.executePrepareOrders(simulatedOrdersActual.orders);
                    console.log(`EXECUTE REMAINING obj ${i} ::: ${obj}`);
                    inAssetAmount = SafeMath.add(inAssetAmount, obj.receivedAssetAmount);

                    slipageTolerance = SafeMath.sub(
                        slipageTolerance,
                        SafeMath.mul(
                            this.getAmountRation(simulatedOrdersExpected.receivedAssetAmount, obj.receivedAssetAmount),
                            this.calculateSlipage(simulatedOrdersExpected.avgPrice, obj.avgPrice, simulatedOrdersExpected.orders[0].side)
                        )
                    );
                    console.log(`slipageTolerance REMAINING ${i} ::: ${slipageTolerance}`);
                    console.log(`inAssetAmount REMAINING ${i} ::: ${inAssetAmount}`);
                }
                if (!inAssetAmount) return stopInPlace();
            }
            resolve({ receivedAmount: inAssetAmount, receivedAsset: obj.receivedAsset, remainingAsset: obj.inAsset, remainingAssetAmout: obj.remainingInAssetAmount, success: true });
        });
    }
    private calculateSlipage(expectedAvgPrice: number, actualAvgPrice: number, side: OrderSide): number {
        if (side == OrderSide.BUY) {
            return SafeMath.div(SafeMath.sub(SafeMath.div(actualAvgPrice, expectedAvgPrice), 1), 100);
        }
        return SafeMath.div(SafeMath.sub(SafeMath.div(expectedAvgPrice, actualAvgPrice), 1), 100);
    }

    private getAmountRation(fullExpectedAmount: number, actualAmount: number): number {
        return SafeMath.div(actualAmount, fullExpectedAmount);
    }
    private async executePrepareOrders(prepareOrders: PrepareOrder[]): Promise<ExecutedOrder> {
        return new Promise<ExecutedOrder>((resolve, reject) => {
            try {
                let executed = 0;
                let orders: Order[] = [];
                let avgPrice = 0;
                let receivedAssetAmount = 0;
                let remainingInAssetAmount = 0;
                let totalExecutedAmount = 0;
                let totalRemainingAmout = 0;
                let book = prepareOrders.length ? prepareOrders[0].exchange.observe(prepareOrders[0].symbol) : null;
                let receivedAsset = prepareOrders.length ? book.getReceivingAsset(prepareOrders[0].side) : '';
                let inAsset = prepareOrders.length ? book.getInAsset(prepareOrders[0].side) : '';
                let finishExecution = () => {
                    for (let o of orders) {
                        let executedAmount = o.getExecutedAmount();
                        remainingInAssetAmount = SafeMath.add(remainingInAssetAmount, o.getInAssetRemainingAmount());
                        totalRemainingAmout = SafeMath.add(totalRemainingAmout, o.getRemainingAmount());
                        if (!executedAmount) continue;
                        // avg = (avg*totalExecutedAmount+price*executedAmount)/(totalExecutedAmount+executedAmount);
                        avgPrice = SafeMath.div(
                            SafeMath.add(SafeMath.mul(avgPrice, totalExecutedAmount), SafeMath.mul(o.getAveragePrice(), executedAmount)),
                            SafeMath.add(totalExecutedAmount, executedAmount)
                        );
                        totalExecutedAmount = SafeMath.add(totalExecutedAmount, executedAmount);
                        receivedAssetAmount = SafeMath.add(receivedAssetAmount, o.getReceivedgAssetAmount());
                    }
                    resolve({ avgPrice, receivedAssetAmount, remainingInAssetAmount, executedAmount: totalExecutedAmount, remainingAmount: totalRemainingAmout, receivedAsset, inAsset });
                };
                let updateClosure = (_this: Order) => {
                    switch (_this.status) {
                        case OrderStatus.NEW:
                            _this.cancelOrder();
                            break;
                        case OrderStatus.PARTIALLY_FILLED:
                            _this.cancelOrder();
                            break;
                        case OrderStatus.EXECUTED:
                            executed++;
                            if (executed == prepareOrders.length) finishExecution();
                            break;
                        case OrderStatus.CANCELLED:
                            executed++;
                            if (executed == prepareOrders.length) finishExecution();
                            else console.log('ChainOrder - order cancelled ----');
                            break;
                        default:
                            break;
                    }
                };
                for (let order of prepareOrders) {
                    let o = Order.createOrder(order.symbol, order.price, order.amount, order.side, OrderType.LIMIT_IOC, order.exchange, updateClosure);
                    if (o) {
                        orders.push(o);
                        o.executeOrder();
                    } else {
                        // if (prepareOrders.length == 1) return finishExecution(); // this will terminate the execution and return 0 0 0 0...
                        executed++; // this prevents deadlock if 1 order null and other execute
                        remainingInAssetAmount = SafeMath.add(remainingInAssetAmount, order.side == OrderSide.SELL ? order.amount : SafeMath.mul(order.amount, order.price));
                        totalRemainingAmout = SafeMath.add(totalRemainingAmout, order.amount);
                    }
                }
                if (!orders.length) setTimeout(() => finishExecution(), 0); // push to back of even queue -> give chance to orderBooks to refresh
                if (executed == prepareOrders.length) setTimeout(() => finishExecution(), 0);
            } catch (e) {
                resolve(null);
            }
        });
    }
}

export default ChainOrders;
