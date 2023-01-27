import Binance from '../exchanges/binance/Binance';
import Order, { OrderSide, OrderStatus, OrderType } from '../Order';
import OrderBook from '../OrderBook';
import SafeMath from '../util/SafeMath';

class PortfolioStrategy {
    public execute(amountUSDT) {
        // USDT -> BUSD (market) -> Limit_Maker for Asset
        let assetAmounts: [string, number][] = [
            ['APT', 0.2],
            ['AVAX', 0.2],
            ['ATOM', 0.2],
            ['BNB', 0.1],
            ['MATIC', 0.1],
            ['ETH', 0.1],
            ['SOL', 0.1],
        ];
        
        let binance = Binance.getInstance();
        let busdUSDT_book = binance.observe('BUSDUSDT');

        let assetBusdBooks: OrderBook[] = [];
        for (let a of assetAmounts) {
            assetBusdBooks.push(binance.observe(a[0] + 'BUSD'));
        }
        let executeAfterCheckBooks = () => {
            if (!busdUSDT_book.getIsReady()) return setTimeout(executeAfterCheckBooks, 1000);
            for (let b of assetBusdBooks) {
                if (!b.getIsReady()) return setTimeout(executeAfterCheckBooks, 1000);
            }
            for (let i = 0; i < assetAmounts.length; i++) {
                let price = busdUSDT_book.getLowestAsk();
                let busdAmount = SafeMath.div(SafeMath.mul(amountUSDT, assetAmounts[i][1]), price);
                let o = Order.createOrder('BUSDUSDT', price, busdAmount, OrderSide.BUY, OrderType.LIMIT, binance, (_this: Order) => {
                    if (_this.status == OrderStatus.EXECUTED) {
                        let actualBUSDAmount = _this.getReceivedgAssetAmount();
                        // let targetBook = assetBusdBooks[i];
                        // let bidPrice = targetBook.getHighestBid();
                        // let orderAmount = SafeMath.div(actualBUSDAmount, bidPrice);
                        let recursiveOrderClosure = (__this: Order) => {
                            if (__this.status == OrderStatus.CANCELLED) {
                                let busdRemainingAmount = __this.getInAssetRemainingAmount();
                                recursiveOrder(busdRemainingAmount);
                                return;
                            }
                            if (__this.status != OrderStatus.EXECUTED) {
                                let timeOut = () => {
                                    if (__this.status == OrderStatus.EXECUTED || _this.status == OrderStatus.CANCELLED) return;
                                    setTimeout(async () => {
                                        let bid = __this.exchange.observe(__this.symbol).getHighestBid();
                                        if (__this.price == bid) return timeOut();
                                        __this.cancelOrder();
                                    }, 5000);
                                };
                                timeOut();
                            }
                            if (__this.status == OrderStatus.EXECUTED) {
                                console.log('EXECUTED!! ', __this.toString());
                            }
                        };
                        let recursiveOrder = (remainingBusdAmount: number) => {
                            let targetBook = assetBusdBooks[i];
                            let bidPrice = targetBook.getHighestBid();
                            let orderAmount = SafeMath.div(remainingBusdAmount, bidPrice);
                            let o2 = Order.createOrder(assetAmounts[i][0] + 'BUSD', bidPrice, orderAmount, OrderSide.BUY, OrderType.LIMIT_MAKER, binance, recursiveOrderClosure);
                            o2 && o2.executeOrder();
                            !o2 && console.log(`PortfolioStrategy - ${assetAmounts[i][0]} - order NULL  - Price: ${bidPrice}  Amount: ${orderAmount}`);
                        };
                        recursiveOrder(actualBUSDAmount);
                    } else {
                        _this.cancelOrder();
                    }
                });

                o && o.executeOrder();
            }
        };

        executeAfterCheckBooks();
    }
}

export default PortfolioStrategy;
