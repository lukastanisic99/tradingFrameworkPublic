import Exchange from './exchanges/Exchange';
import SafeMath from './util/SafeMath';

export enum OrderStatus {
    NOT_SENT,
    NEW,
    PARTIALLY_FILLED,
    EXECUTED,
    CANCELLED,
}

export enum OrderSide {
    BUY,
    SELL,
}

export enum OrderType {
    MARKET,
    LIMIT,
    LIMIT_MAKER,
    LIMIT_IOC, //imediate or cancel
}

export class Commission {
    public asset: string;
    public amount: number;

    public constructor(asset: string, amount: number) {
        this.asset = asset;
        this.amount = amount;
    }
}

export class Filled {
    public amount: number;
    public price: number;
    public comissions: Commission[];

    public constructor(amount: number, price: number, commissions: Commission[] = []) {
        this.amount = amount;
        this.price = price;
        this.comissions = commissions;
    }

    public toString(): string {
        return '';
    }
}

export class SimulateOrder {
    avgPrice: number;
    receivedAssetAmount: number;
    orders: PrepareOrder[];
}
export class PrepareOrder {
    price: number;
    amount: number;
    side: OrderSide;
    symbol: string;
    exchange: Exchange;
}

export class ExecutedOrder {
    avgPrice: number;
    receivedAssetAmount: number;
    remainingInAssetAmount: number;
    executedAmount: number;
    remainingAmount: number;
    receivedAsset: string;
    inAsset: string;
}
class Order {
    public updateClosure: (_this: Order) => void;
    public symbol: string;
    public asset1: string;
    public asset2: string;
    public status: OrderStatus;
    public orderId: string;
    public side: OrderSide;
    public type: OrderType;
    public price: number;
    public amount: number;
    public timestamp: number;
    public exchange: Exchange;
    public filled: Filled[] = [];
    public lastUpdateTime; //this field may be unused

    private isCanceled = false;
    private isExecuted = false;
    /**
     *
     * @param symbol get this from the OrderBook
     * @param price
     * @param amount
     * @param side
     * @param type
     * @param updateClosure the closure function (has full context) that is executed after the status of an Order changes
     */
    private constructor(symbol: string, price: number, amount: number, side: OrderSide, type: OrderType, exchange: Exchange, updateClosure: (_this: Order) => void) {
        this.updateClosure = updateClosure;
        this.exchange = exchange;
        this.price = price;
        this.amount = amount;
        this.side = side;
        this.type = type;
        this.symbol = symbol;
        this.timestamp = new Date().getMilliseconds();
        this.status = OrderStatus.NOT_SENT;
        let tickerJSON = this.exchange.getTickersJSON();
        this.asset1 = tickerJSON.pairs[this.symbol].asset1;
        this.asset2 = tickerJSON.pairs[this.symbol].asset2;
    }

    /**
     * Creates an order that's filtered and reserves funds -> returns null if fails -> this order is ready to be executed uncodtitionally
     */
    public static createOrder(
        symbol: string,
        price: number,
        amount: number,
        side: OrderSide,
        type: OrderType,
        exchange: Exchange,
        updateClosure: (_this: Order) => void,
        shouldReserve: boolean = true
    ) {
        let o = new Order(symbol, price, amount, side, type, exchange, updateClosure);
        o = exchange.applyFilters(o);
        if (!o) return o;
        let amountReserved = 0;
        if (!shouldReserve) return o;
        if (o.side == OrderSide.BUY) {
            amountReserved = exchange.getAccount().getBalance(o.asset2).reserve(SafeMath.mul(o.amount, o.price));
        } else {
            amountReserved = exchange.getAccount().getBalance(o.asset1).reserve(o.amount);
        }
        if (amountReserved) return o;
        return null;
    }

    //Used to abort a strategy after creating an order and reserving funds
    public dropOrder() {
        if (this.status != OrderStatus.NOT_SENT) return;
        if (this.side == OrderSide.BUY) {
            this.exchange.getAccount().getBalance(this.asset2).release(SafeMath.mul(this.amount, this.price));
        } else {
            this.exchange.getAccount().getBalance(this.asset1).release(this.amount);
        }
    }

    public async cancelOrder(): Promise<boolean> {
        if (this.isCanceled) return false;
        this.isCanceled = true;
        return await this.exchange.cancelOrderAsync(this);
    }
    public async executeOrder(): Promise<boolean> {
        if (this.isExecuted) return true;
        this.isExecuted = true;
        return await this.exchange.executeOrderAsync(this);
    }
    public update(status: OrderStatus, filled: Filled[] = []) {
        if (this.status == status && status != OrderStatus.PARTIALLY_FILLED) return; //NEW CANCELLED EXECUTED can be triggered only once
        this.status = status;
        if (status == OrderStatus.CANCELLED) this.isCanceled = true;
        if (filled) this.filled.push(...filled);
        this.updateAccounts(filled);
        this.updateClosure(this);
    }
    private updateAccounts(filled?: Filled[]) {
        let totalAmountAsset1 = 0;
        let totalAmountAsset2 = 0;
        let commissionAsset1 = 0;
        let commissionAsset2 = 0;
        for (let f of filled) {
            totalAmountAsset1 = SafeMath.add(totalAmountAsset1, f.amount);
            totalAmountAsset2 = SafeMath.add(totalAmountAsset2, SafeMath.mul(f.amount, f.price));
            for (let c of f.comissions) {
                if (c.asset == this.asset1) {
                    commissionAsset1 = SafeMath.add(commissionAsset1, c.amount);
                } else if (c.asset == this.asset2) {
                    commissionAsset2 = SafeMath.add(commissionAsset2, c.amount);
                } else {
                    let balance = this.exchange.getAccount().getBalance(c.asset);
                    balance.decreaseAvailable(c.amount);
                }
            }
        }
        let balance1 = this.exchange.getAccount().getBalance(this.asset1);
        let balance2 = this.exchange.getAccount().getBalance(this.asset2);
        if (this.side == OrderSide.BUY) {
            balance1.increaseAvailable(totalAmountAsset1);
            balance1.decreaseAvailable(commissionAsset1);
            balance2.decreaseLocked(totalAmountAsset2);
            balance2.decreaseAvailable(commissionAsset2);
        } else {
            balance1.decreaseLocked(totalAmountAsset1);
            balance1.decreaseAvailable(commissionAsset1);
            balance2.increaseAvailable(totalAmountAsset2);
            balance2.decreaseAvailable(commissionAsset2);
        }

        if (this.status == OrderStatus.CANCELLED) {
            if (this.side == OrderSide.BUY) {
                let totalLockedAsset2 = SafeMath.mul(this.price, this.amount);
                let executedAmountAsset2 = SafeMath.mul(this.getExecutedAmount(), this.getAveragePrice());
                balance2.release(SafeMath.sub(totalLockedAsset2, executedAmountAsset2));
            } else {
                balance1.release(SafeMath.sub(this.amount, this.getExecutedAmount()));
            }
        }
    }

    public getExecutedAmount(): number {
        let sum = 0;
        for (let f of this.filled) {
            sum = SafeMath.add(sum, f.amount);
        }
        return sum;
    }
    public getAveragePrice(): number {
        let sum = 0;
        let cnt = 0;
        for (let f of this.filled) {
            sum = SafeMath.add(sum, SafeMath.mul(f.amount, f.price));
            cnt = SafeMath.add(cnt, f.amount);
        }
        if (cnt == 0) return 0;
        return SafeMath.div(sum, cnt);
    }

    public getReceivedgAssetAmount(): number {
        let executedAmount = this.getExecutedAmount();
        let commissions = this.getCommissions();
        let receivedAmount = executedAmount;
        if (this.side == OrderSide.BUY) {
            for (let c of commissions) {
                if (c.asset == this.asset1) {
                    receivedAmount = SafeMath.sub(receivedAmount, c.amount);
                }
            }
        } else {
            receivedAmount = SafeMath.mul(executedAmount, this.getAveragePrice());
            for (let c of commissions) {
                if (c.asset == this.asset2) {
                    receivedAmount = SafeMath.sub(receivedAmount, c.amount);
                }
            }
        }
        return receivedAmount;
    }
    public getInAssetRemainingAmount(): number {
        let executedAmount = this.getExecutedAmount();
        if (this.side == OrderSide.SELL) return SafeMath.sub(this.amount, executedAmount);
        return SafeMath.sub(SafeMath.mul(this.amount, this.price), SafeMath.mul(executedAmount, this.getAveragePrice()));
    }

    public getRemainingAmount(): number {
        return SafeMath.sub(this.amount, this.getExecutedAmount());
    }

    public getCommissions(): Commission[] {
        let coms: Commission[] = [];
        let found = false;
        //This is inefficient but considering filled and/or comissions will be length 1 most of the time and in most cases <5 - this doesn't matter
        for (let f of this.filled) {
            for (let commission of f.comissions) {
                found = false;
                for (let c of coms) {
                    if ((commission.asset = c.asset)) {
                        found = true;
                        c.amount = SafeMath.add(c.amount, commission.amount);
                    }
                }
                if (!found) coms.push(new Commission(commission.asset, commission.amount));
            }
        }
        return coms;
    }
    public getReceivingAsset(): string {
        if (this.side == OrderSide.BUY) return this.asset1;
        return this.asset2;
    }
    public getInAsset(): string {
        if (this.side == OrderSide.BUY) return this.asset2;
        return this.asset1;
    }
    public toString(): string {
        let str = `Order:
        symbol: ${this.symbol}
        status: ${this.status}
        orderId: ${this.orderId}
        side: ${this.side}
        type: ${this.type}
        price: ${this.price}
        amount: ${this.amount}
        timestamp: ${this.timestamp}
        exchange: ${this.exchange.constructor.name}
        executed amount: ${this.getExecutedAmount()}
        average price: ${this.getAveragePrice()}
        `;
        return str;
    }
}

export default Order;
