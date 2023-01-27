import Logger from '../Logger';
import OrderBook from '../OrderBook';
import Strategy from '../Strategy';
import { Observable, Observer } from '../util/Observer/Observer';

class ArbitrageStrategy extends Strategy {
    private lowestAsk: OrderBook;
    private highestBid: OrderBook;
    private maxPercentage: number = 0;
    public execute() {
        if (this.lowestAsk && this.highestBid) {
            if (!this.highestBid.getHighestBid() || !this.lowestAsk.getLowestAsk()) {
                console.log('Race CONDITION - LowestAsk - HighestBid');
                return; //this can happen when race condition and only 1 ask or 1 bid is present
            }
            // console.log("Arbitrage %:",this.highestBid.getHighestBid()/this.lowestAsk.getLowestAsk(), ' lowestAsk: ', this.lowestAsk.getLowestAsk(), '  highestBid:  ', this.highestBid.getHighestBid());
            let percentage = this.highestBid.getHighestBid() / this.lowestAsk.getLowestAsk();
            if (percentage > this.maxPercentage) {
                this.maxPercentage = percentage;
                Logger.log('' + percentage + ' ' + new Date().toString(), true, this.strategyName);
                console.log('' + percentage + ' ' + new Date().toString(), this.strategyName);
            }
        }
    }

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
}

export default ArbitrageStrategy;
