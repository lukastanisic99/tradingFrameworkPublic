import Order, { OrderSide, OrderStatus, OrderType } from '../Order';
import Logger from '../Logger';
import OrderBook from '../OrderBook';
import Strategy from '../Strategy';
import { Observable, Observer } from '../util/Observer/Observer';

class TestStrategy extends Strategy {
    private lowestAsk: OrderBook;
    private highestBid: OrderBook;
    private maxPercentage: number = 0;
    private executing = false;
    public execute() {
        let book = this.observables[0];

        //termination condition
        let a = book.getLowestAsk();
        let b = book.getHighestBid();
        if (!a || !b || this.executing) return;
        this.executing = true;
        let exchange = book.getExchange();
        let balance = exchange.getAccount().getBalance(book.getAsset1());
        let amount = 0.05345;
        if (!amount) return (this.executing = false);
        let price = book.getLowestAsk() * 1.1;
        let order = Order.createOrder(book.getSymbol(), price, amount, OrderSide.SELL, OrderType.LIMIT, exchange, (_this: Order) => {
            console.log(order.status);
            if (order.status == OrderStatus.CANCELLED || order.status == OrderStatus.EXECUTED) this.executing = false;
            if (order.status != OrderStatus.CANCELLED) exchange.cancelOrderAsync(order);
        });
        if (!order) return (this.executing = false);
        console.log(order.toString());
        book.getExchange().executeOrderAsync(order);
        this.executing = false;
        order.dropOrder();
        return (this.executing = false);
    }

    protected _notify(observable: Observable) {
        this.execute();
    }
}

export default TestStrategy;
