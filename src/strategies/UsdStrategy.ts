import Order, { OrderSide, OrderStatus, OrderType } from '../Order';
import Logger from '../Logger';
import OrderBook from '../OrderBook';
import Strategy from '../Strategy';
import { Observable, Observer } from '../util/Observer/Observer';
import Binance from '../exchanges/binance/Binance';

class UsdStrategy extends Strategy {
    public execute() {
        let book = this.observables[0];

        //termination condition
        let a = book.getLowestAsk();
        let b = book.getHighestBid();
        if (!a || !b) return;
        let exchange = book.getExchange();

        let busdBalance = exchange.getAccount().getBalance(book.getAsset1());
        let usdtBalance = exchange.getAccount().getBalance(book.getAsset2());

        //SELL BUSD
        let busdAmount = busdBalance.getAvailable();
        if (busdAmount) {
            let order = Order.createOrder(book.getSymbol(), 1, busdAmount, OrderSide.SELL, OrderType.LIMIT, exchange, (_this: Order) => {
                if (order.status == OrderStatus.NEW) {
                    Logger.log(`Created BUSD SELL ORDER price:${order.price} amount ${order.amount}`, true);
                }
                if (order.status == OrderStatus.PARTIALLY_FILLED) {
                    Logger.log(`PARTIALLY_FILLED BUSD SELL ORDER price:${order.price} amount:${order.amount} filled:${order.getExecutedAmount()}`, true);
                }
                if (order.status == OrderStatus.EXECUTED) {
                    Logger.log(`EXECUTED BUSD SELL ORDER price:${order.price} amount:${order.amount}`, true);
                }
            });
            if (order) exchange.executeOrderAsync(order);
        }

        //BUY BUSD
        let usdtAmount = usdtBalance.getAvailable();
        if (usdtAmount) {
            busdAmount = usdtAmount / 0.9999;
            let order = Order.createOrder(book.getSymbol(), 0.9999, busdAmount, OrderSide.BUY, OrderType.LIMIT, exchange, (_this: Order) => {
                if (order.status == OrderStatus.NEW) {
                    Logger.log(`Created BUSD BUY ORDER price:${order.price} amount ${order.amount}`, true);
                }
                if (order.status == OrderStatus.PARTIALLY_FILLED) {
                    Logger.log(`PARTIALLY_FILLED BUSD BUY ORDER price:${order.price} amount:${order.amount} filled:${order.getExecutedAmount()}`, true);
                }
                if (order.status == OrderStatus.EXECUTED) {
                    Logger.log(`EXECUTED BUSD BUY ORDER price:${order.price} amount:${order.amount}`, true);
                }
            });
            if (order) exchange.executeOrderAsync(order);
        }
    }

    protected _notify(observable: Observable) {
        this.execute();
    }
}

export default UsdStrategy;
