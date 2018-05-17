"use strict";


var Hold = function (obj) {
    this.hold = {};
    this.parse(obj);
};

Hold.prototype = {
    toString: function () {
        return JSON.stringify(this.hold);
    },

    parse: function (obj) {
        if (typeof obj != "undefined") {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.hold[key] = new BigNumber(data[key]);
            }
        }
    },

    get: function (key) {
        return this.hold[key];
    },

    set: function (key, value) {
        this.hold[key] = new BigNumber(value);
    }
};

var AirdropItem = function(text) {
	if (text) {
		var obj = JSON.parse(text);
        this.controller = obj.controller;
        this.index = obj.index;
        this.name = obj.name;
        this.symbol = obj.symbol;
        this.totalSupply = obj.totalSupply;
        this.holderNum = obj.holderNum;
        this.holderBonus = obj.holderBonus;
        this.referrerBonus = obj.referrerBonus;
        this.desc = obj.desc;
        this.active = obj.active;
	} else {
        this.controller = "";
        this.index = new BigNumber(0);
        this.name = "";
        this.symbol = "";
        this.totalSupply = new BigNumber(0);
        this.holderNum = new BigNumber(0);
        this.holderBonus = new BigNumber(0);
        this.referrerBonus = new BigNumber(0);
        this.desc = "";
        this.active = true;
	}
};

AirdropItem.prototype = {
	toString: function () {
		return JSON.stringify(this);
	}
};

var Airdrops = function () {
    LocalContractStorage.defineMapProperties(this, {
        "airdrops": {
            parse: function (text) {
                return new AirdropItem(text);
            }
            ,
            stringify: function (o) {
                return o.toString();
            }
        },
        "hold": {
            parse: function (text) {
                return new Hold(text);
            },
            stringify: function (o) {
                return o.toString();
            }
        }
    });

    LocalContractStorage.defineProperty(this, "count", {
        stringify: function (obj) {
            return obj.toString();
        },
        parse: function (str) {
            return new BigNumber(str);
        }
    });
};

Airdrops.prototype = {
    init: function () {
        this.count = 0;
    },

    newAirdrop: function (name, symbol, holderBonus, referrerBonus, desc) {
        name = name.trim();
        symbol = symbol.trim();
        desc = desc.trim();

        if (name === "" || symbol === "" || desc === ""){
            throw new Error("empty name / symbol / description");
        }
        if (name.length > 64 || symbol.length > 64 || desc.length > 64){
            throw new Error("name / symbol / description exceed limit length")
        }

        if (holderBonus <=0 || referrerBonus<= 0){
            throw new Error("invalid holder / referrer bonus");
        }

        var from = Blockchain.transaction.from;
        var airdropItem = new AirdropItem();
        airdropItem.controller = from;
        airdropItem.index = this.count;
        airdropItem.name = name;
        airdropItem.symbol = symbol;
        airdropItem.holderBonus = new BigNumber(holderBonus);
        airdropItem.referrerBonus = new BigNumber(referrerBonus);
        airdropItem.desc = desc;
        var count = LocalContractStorage.get("count");
        this.airdrops.put(count, airdropItem);
        this.count = this.count.plus(1);
    },

    active: function (airdropIndex, active) {
        var from = Blockchain.transaction.from;
        var airdropItem = this.airdrops.get(airdropIndex);
        if(airdropItem){
            if(airdropItem.controller === from){
                airdropItem.active = active;
            } else {
                throw new Error("you have no right to change this airdrop");
            }
        }
        this.airdrops.put(airdropIndex, airdropItem);
    },

    receive: function (airdropIndex, _referrer) {
        _referrer = _referrer.trim();
        var from = Blockchain.transaction.from;
        if(_referrer === "" || Blockchain.verifyAddress(_referrer)){
            if(from === _referrer){
                throw new Error("can not refer yourself");
            }
            var airdropItem = this.airdrops.get(airdropIndex);
            if(parseInt(airdropIndex) >= this.count) {
                return;
            }
            if(!airdropItem.active){
                throw new Error("airdrop over");
            }
            if(airdropItem && airdropItem.active){
                var hold = this.hold.get(airdropIndex) || new Hold();
                if(hold.get(from)){
                    throw new Error("you have got the airdrop");
                }
                hold.set(from, airdropItem.holderBonus);
                airdropItem.totalSupply = new BigNumber(parseInt(airdropItem.totalSupply)).plus(airdropItem.holderBonus);
                if(hold.get(_referrer)) {
                    hold.set(from, hold.get(from).plus(airdropItem.referrerBonus));
                    hold.set(_referrer, hold.get(_referrer).plus(airdropItem.referrerBonus));
                    airdropItem.totalSupply = new BigNumber(parseInt(airdropItem.totalSupply)).plus(airdropItem.referrerBonus * 2);
                }
                airdropItem.holderNum = new BigNumber(parseInt(airdropItem.holderNum)).plus(1);
                this.airdrops.put(airdropIndex, airdropItem);
                this.hold.put(airdropIndex, hold);
            }
        } else {
            throw new Error("invalid referrer address");
        }

    },

    len: function() {
        return parseInt(this.count);
    },

    index: function(airdropIndex) {
        var airdropItem = this.airdrops.get(airdropIndex);
        if(airdropItem){
            return airdropItem;
        }
    },

    query: function(airdropIndex, address) {
        if(airdropIndex >= this.count){
            return  {index: airdropIndex, balance: 0};
        }
        if(Blockchain.verifyAddress(address)){
        var hold = this.hold.get(airdropIndex);
        if (hold instanceof Hold) {
            var bonus = hold.get(address);
            if (typeof bonus != "undefined") {
                return {index: airdropIndex, balance: bonus.toString(10)};
            }
        }
        return {index: airdropIndex, balance: 0};
        } else {
            throw new Error("invalid address");
        }
    },

    dump: function(airdropIndex){
        if(airdropIndex >= this.count) {
            return "";
        }
        var airdropItem = this.airdrops.get(airdropIndex);
        var hold = this.hold.get(airdropIndex);

        if (hold instanceof Hold) {
           return hold.toString();
        }
        return "";
    }
};

module.exports = Airdrops;