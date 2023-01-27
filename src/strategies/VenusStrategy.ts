import ChainOrders, { Simulation } from '../ChainOrders';
import Binance from '../exchanges/binance/Binance';
import OrderBook from '../OrderBook';
import SafeMath from '../util/SafeMath';

class VenusStrategy {
    public async execute(amountUSDT) {
        let binance = Binance.getInstance();
        let booksArray: OrderBook[][] = [
            [binance.observe('XVSUSDT')],
            [binance.observe('BUSDUSDT'), binance.observe('XVSBUSD')],
            [binance.observe('BNBUSDT'), binance.observe('XVSBNB')],
            [binance.observe('BTCUSDT'), binance.observe('XVSBTC')],
        ];
        let chains: ChainOrders[] = [];
        for (let books of booksArray) {
            chains.push(new ChainOrders(binance, books));
        }
        let remaining = amountUSDT;
        let executeCycle = async () => {
            for (let books of booksArray) {
                for (let book of books) {
                    if (!book.getIsReady()) return await new Promise((r) => setTimeout(r, 2000));
                }
            }
            let simulations: [Simulation, ChainOrders][] = [];
            for (let c of chains) {
                let s = c.getSimulatedExecution('USDT', remaining, true, true);
                simulations.push([s, c]);
            }
            simulations.sort((a: [Simulation, ChainOrders], b: [Simulation, ChainOrders]): number => {
                return SafeMath.mul(a[0].avgPrice, SafeMath.add(1, a[0].totalTakerFee)) - SafeMath.mul(b[0].avgPrice, SafeMath.add(1, b[0].totalTakerFee));
            });
            // remaining -= inAssetAmount
            remaining = SafeMath.sub(remaining, simulations[0][0].inAssetAmount);
            // let obj = await simulations[0][1].executeSimulation(simulations[0][0].simulationId, 0.005);
            // if (obj.success) {
            //     remaining = SafeMath.add(remaining, obj.remainingAssetAmout);
            // } else {
            //     remaining = 0;
            // }
        };
        while (remaining) {
            await executeCycle();
            console.log('AA');
        }
    }
}
export default VenusStrategy;
