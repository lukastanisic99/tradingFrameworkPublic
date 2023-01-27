import OrderBook from './OrderBook';
import { Observable, Observer } from './util/Observer/Observer';

abstract class Strategy extends Observer {
    protected observables: OrderBook[];
    protected strategyName: string;

    public constructor(strategyName?: string) {
        super();
        this.strategyName = strategyName || 'default';
    }

    public abstract execute();
}

export default Strategy;
