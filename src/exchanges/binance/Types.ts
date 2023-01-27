export class ExchnageInfo {
    private symbols: Map<string, SymbolInfo> = new Map<string, SymbolInfo>();

    public getSymbolInfo(symbol: string): SymbolInfo {
        return this.symbols.get(symbol);
    }

    public setSymbolInfo(symbol: string, jsonSymbolInfo: any) {
        let s = new SymbolInfo();
        this.symbols.set(symbol, s);
        for (let f of jsonSymbolInfo.filters) {
            s.setFilter(f.filterType, f);
        }
    }
}
export class SymbolInfo {
    private filters: Map<string, any> = new Map<string, any>();

    public getFilter(filterType: string): SymbolInfo {
        return this.filters.get(filterType);
    }

    public setFilter(filterType: string, jsonFilter: any) {
        this.filters.set(filterType, jsonFilter);
    }
}

export interface SymbolTradeFee {
    symbol: string;
    makerCommission: string; //eg. '0.001'
    takerCommission: string;
}
