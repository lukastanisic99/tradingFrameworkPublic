import Binance from './exchanges/binance/Binance';
import Bitfinex from './exchanges/bitfinex/bitfinex';
import RBTree from './util/RBTree/RBTree';
import RBIterator, { MinRBIterator, MaxRBIterator } from './util/RBTree/Iterator';
import ArbitrageStrategy from './strategies/ArbitrageStrategy';
import donenv from 'dotenv';
import TestStrategy from './strategies/TestStrategy';
import UsdStrategy from './strategies/UsdStrategy';
import SafeMath from './util/SafeMath';
import { SymbolTradeFee } from './exchanges/binance/Types';
import ChainOrders from './ChainOrders';
import PortfolioStrategy from './strategies/PortfolioStrategy';
import VenusStrategy from './strategies/VenusStrategy';
import AptosSavings from './strategies/AptosSavings';
donenv.config();

let o;
let main = async () => {
    try {
        await Binance.initAsync();
        let binance = Binance.getInstance();
        let bitfinex = Bitfinex.getInstance();

        let aptosSavings = new AptosSavings();
        aptosSavings.execute();

        let v = new VenusStrategy();
        await v.execute(1000);

        let p = new PortfolioStrategy();
        p.execute(1000);

        let usdStratrategy = new UsdStrategy('USD Strategy');
        o = binance.observe('BUSDUSDT');
        usdStratrategy.subscribe(o);
        usdStratrategy.subscribe(binance.getAccount().getBalance('BUSD'));
        usdStratrategy.subscribe(binance.getAccount().getBalance('USDT'));

        //Test
        let test = new TestStrategy('Test BNB buy');
        o = binance.observe('BNBUSDT');
        test.subscribe(o);
        test.subscribe(binance.getAccount().getBalance('BNB'));
        // test.execute();
       
        //ETH Arbitrage
        let ethArb = new ArbitrageStrategy("ETH-Arbitrage");
         o = bitfinex.observe('tETHUSD');
        ethArb.subscribe(o);
        o = binance.observe('ETHUSDT');
        ethArb.subscribe(o);

        //Polygon Arbitrage
        let polygonArb = new ArbitrageStrategy("Polygon-Arbitrage");
        o = bitfinex.observe('tMATIC:USD');
        polygonArb.subscribe(o);
        o = binance.observe('MATICUSDT');
        polygonArb.subscribe(o);

        //ADA Arbitrage
        let adaArb = new ArbitrageStrategy("ADA-Arbitrage");
        o = bitfinex.observe('tADAUSD');
        adaArb.subscribe(o);
        o = binance.observe('ADAUSDT');
        adaArb.subscribe(o);

        //DOT Arbitrage
        let dotArb = new ArbitrageStrategy("DOT-Arbitrage");
        o = bitfinex.observe('tDOTUSD');
        dotArb.subscribe(o);
        o = binance.observe('DOTUSDT');
        dotArb.subscribe(o);

        //SOL Arbitrage
        let solArb = new ArbitrageStrategy("SOL-Arbitrage");
        o = bitfinex.observe('tSOLUSD');
        solArb.subscribe(o);
        o = binance.observe('SOLUSDT');
        solArb.subscribe(o);

        //IOTA Arbitrage
        let iotaArb = new ArbitrageStrategy("IOTA-Arbitrage");
        o = bitfinex.observe('tIOTUSD');
        iotaArb.subscribe(o);
        o = binance.observe('IOTAUSDT');
        iotaArb.subscribe(o);
    } catch (e) {
        console.log(e);
    }


    //Test red black tree 
    if (0) {
        function shuffleArray(array) {
            for (var i = array.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
        }

        let numberOfInsertions = 1000000;
        let keys = [...Array(numberOfInsertions).keys()];
        let time = Date.now();
        let cnt = 0;
        let rb = new RBTree();
        //worst case
        while (Date.now() - time < 1000) {
            rb.insert(keys[cnt++], '');
        }
        console.log('CNT::::::::', cnt);

        //random case

        // keys = [...Array(numberOfInsertions).keys()];
        shuffleArray(keys);
        time = Date.now();
        cnt = 0;
        rb = new RBTree();
        while (Date.now() - time < 1000) {
            rb.insert(keys[cnt++], '');
        }
        console.log('CNT::::::::', cnt);
        let error = 0;

        if (!error) {
            let loop = 1;
            let deletedKeys = [];
            let keysCopy;
            let keys = [];
            try {
                for (let i = 0; i < loop; i++) {
                    let t = new RBTree();
                    let stop = false;
                    let treeSize = 10;
                    for (let j = 0; j < treeSize; j++) {
                        let n = Math.floor(Math.random() * 1000);
                        keys.push(n);
                        t.insert(n, "Doesn't matter");
                        if (!t.checkIntegrity()) {
                            console.log('Integrity violation', keys);
                            stop = true;
                            break;
                        }
                    }
                    // t.printTree()
                    let it: RBIterator = new MinRBIterator(t);
                    while (it.hasNext()) {
                        console.log(it.next().key);
                    }
                    console.log('---------------------');

                    it = new MaxRBIterator(t);
                    while (it.hasNext()) {
                        console.log(it.next().key);
                    }

                    console.log('MIN NODE:::::', t.getMinNode().key);
                    console.log('MAX NODE:::::', t.getMaxNode().key);
                    keysCopy = JSON.parse(JSON.stringify(keys));
                    for (let j = 0; j < treeSize; j++) {
                        let index = Math.floor(Math.random() * keysCopy.length);
                        let key = keysCopy[index];
                        deletedKeys.push(key);
                        keysCopy.splice(index, 1);
                        t.delete(key);
                        if (!t.checkIntegrity()) {
                            console.log('Integrity violation - delete', keys, deletedKeys);
                            stop = true;
                            break;
                        }
                    }

                    if (stop) break;
                    console.log('MIN NODE:::::', t.getMinNode().key);
                    console.log('MAX NODE:::::', t.getMaxNode().key);
                    console.log(
                        keys.sort((a, b) => {
                            return a - b;
                        })
                    );
                }
                console.log('Done');
            } catch (e) {
                console.log('Keys', keys, 'Deleted Keys', deletedKeys);
            }
        } else {
            let keys = [932, 604, 304, 67, 756];
            let deletedKeys = [756, 932, 604, 304, 67];
            let t = new RBTree();
            for (let k of keys) {
                t.insert(k, '');
                // t.printTree();
                // console.log("---------")
            }
            if (!t.checkIntegrity()) console.log('Integrity violation');
            // t.printTree();
            t.printBFS();
            for (let k of deletedKeys) {
                if (k == 67) {
                    console.log('');
                }
                t.delete(k);

                console.log('Delete:', k);
                t.printBFS();
                // t.printTree();
                // console.log("---------")
                if (!t.checkIntegrity()) console.log('Integrity violation - delete');
            }
            if (!t.checkIntegrity()) console.log('Integrity violation - delete');
        }
    }
};

main();
