# Intro

This project represnets a framework for executing arbitrary complex strategies across different exchanges. It's important to note that the framework is still under development.

The framework provides a common way to interact with exchanges, create orders and perform updates as the state of those orders change on exchanges. 

Some strategies are provided and can be used as examples, but ultimately it's up to you to write your own strategies. 

Running this framework requires an .env file. Take a look at .env.example.


# Example usage
initialize all conrete exchange implementations. This is done only once, usually at the beginning. Example for Binance:
```sh
await Binance.initAsync();
```
This loads the initial snapshot of account balances, opens appropriate WebSocket connections and initializes everything that's needed to interact with Binance.

Later you just run:
```sh
Binance.getInstance()
```
to get an exchange instance of Binance. This can be called from anywhere in the code without any additonal requirments or references, since all exchanges are implemented as Singletons.

To create an order:
```sh
let o = Order.createOrder('BTCUSDT', price, amount, OrderSide.BUY, OrderType.LIMIT, exchangeInstance, updateClosure)
```
This tries to create an Order object for the exchangeInstance provided. It handles everything from applying exchange filters (if the exchange has any - eg. min order size > 10usd...), it tries and reserves the appropirate amount of funds in your local account book and applies other checks aswell. If successfull returns an object instance, otherwise returns null.

The 'updateClosure' allows you to pass a custom function that gets executed each time the state of the Order changes on exchanges. 

Example: 
```sh
let o = Order.createOrder('BUSDUSDT', price, busdAmount, OrderSide.BUY, OrderType.LIMIT, binance, (_this: Order) => {
    if (_this.status == OrderStatus.EXECUTED) {
        console.log("Order fully executed", __this.toString());
        //rest of the logic
    }
    if (_this.status == OrderStatus.PARTIALLY_FILLED) {
        console.log("Order partially executed");
        _this.cancelOrder();
        //rest of the logic
    }
    if (_this.status == OrderStatus.NEW) {
        console.log("Order added to order book");
        //rest of the logic
    }
    if (_this.status == OrderStatus.CANCELLED) {
        console.log("Order cancelled");
        //rest of the logic
    }
})
``` 

To execute an order returned by createOrder call:
```sh
o.executeOrder();
```

You don't need to worry about keeping track of account balances or anything else. Everything is done for you, but if you want to know your available balance, you can. 
Call: 
```sh
let usdtBalance = exchangeInstance.getAccount().getBalance('USDT');
```
Strategies have an option to subscribe to Observables (Account balances, OrderBooks and anything else that implements/extends Observable) and get notified when the state of the Observable changes. This implements the Observer design pattern. This is usefull for strategies that are highly depentend on new information like the Arbitrage strategy.
Example:
```sh
let ethArb = new ArbitrageStrategy("ETH-Arbitrage");
         orderBook = bitfinex.observe('tETHUSD');
        ethArb.subscribe(o);
        orderBook = binance.observe('ETHUSDT');
        ethArb.subscribe(o);
```
The Observer has to implement a _notify method which gets called on observable state update.
Arbitrage example:
```sh
protected _notify(observable: Observable) {
        if (observable instanceof OrderBook) {
            if (!this.lowestAsk || observable.getLowestAsk() < this.lowestAsk.getLowestAsk()) {
                this.lowestAsk = observable;
            }
            if (!this.highestBid || observable.getHighestBid() > this.highestBid.getHighestBid()) {
                this.highestBid = observable;
            }
        }
        this.execute();
    }
```

The Order Book can be fetched through:
```sh
exchangeInstance.observe('BTCUSDT')
```
The OrderBook is implemented as a modified Red-Black tree that's efficient for high frequency insertions and deletions O(logN) + provides O(1) lookups for lowest and highest price which are mostly used with OrderBooks.

# Disclaimer
This is not financial advice! The software is provied "as is" with no gurantees. Use at your own risk.