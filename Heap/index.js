console.log("Hello World");

var StockPrice = function () {
    this.latestPriceMap = new Map();
    this.latestTimeStamp = null;

    this.maxQ = new MaxHeapp();
    this.minQ = new MinHeapp();
};

/** 
 * @param {number} timestamp 
 * @param {number} price
 * @return {void}
 */
StockPrice.prototype.update = function (timestamp, price) {
    this.latestPriceMap.set(timestamp, price);
    this.latestTimeStamp = this.latestTimeStamp > timestamp ? this.latestTimeStamp : timestamp;


    if (this.maxQ.store.length === 0) {
        this.maxQ.add({ timestamp, price });
        this.minQ.add({ timestamp, price });
    } else {
        this.maxQ.update(timestamp, price);
        this.minQ.update(timestamp, price);
    }
};

/**
 * @return {number}
 */
StockPrice.prototype.current = function () {
    return this.latestPriceMap.get(this.latestTimeStamp);
};

StockPrice.prototype.maximum = function () {
    console.log(this.maxQ.store)
    return this.maxQ.peek().price;
};

/**
 * @return {number}
 */
StockPrice.prototype.minimum = function () {
    console.log(this.minQ.store)
    return this.minQ.peek().price;
};

/** 
 * Your StockPrice object will be instantiated and called as such:
 * var obj = new StockPrice()
 * obj.update(timestamp,price)
 * var param_2 = obj.current()
 * var param_3 = obj.maximum()
 * var param_4 = obj.minimum()
 */


class MaxHeapp  {
    constructor(){
        this.store = [];
    }


    getParentIndex = index => Math.floor((index - 1) / 2);
    getLeftChildIndex = index => index * 2 + 1;
    getRightChildIndex = index => index * 2 + 2;

    ifParentExists = index => (this.getParentIndex(index) >= 0);
    ifLeftChildExists = index => (this.getLeftChildIndex(index) <= this.store.length - 1);
    ifRightChildExists = index => (this.getRightChildIndex(index) <= this.store.length - 1);

    swap = (i, j) => [this.store[i], this.store[j]] = [this.store[j], this.store[i]];

    getValFromIndex = (index) => this.store[index].price;

    peek = () => this.store[0];


    heapifyDown = () => {
        let index = 0;

        while (this.ifLeftChildExists(index)) {
            let largeChildIndex = this.getLeftChildIndex(index);

            if (this.ifRightChildExists(index) &&
                this.getValFromIndex(this.getRightChildIndex(index)) >
                this.getValFromIndex(this.getleftChildIndex(index))) {
                largeChildIndex = this.getRightChildIndex(index);
            }

            if (this.store[largeChildIndex] < this.store[index]) {
                break;
            } else {
                this.swap(largeChildIndex, index);
            }

            index = largeChildIndex;
        }


    }

    heapifyUp = () => {
        let index = this.store.length - 1;

        while (this.ifParentExists(index) &&
            this.getValFromIndex(index) >
            this.getValFromIndex(this.getParentIndex(index))) {
            this.swap(index, this.getParentIndex(index));
            index = this.getParentIndex(index);
        }
    }

    add = (el) => {
        this.store.push(el);
        this.heapifyUp();
    }

    delete = () => {
        if (this.store.length === 0) {
            return null;
        }

        const item = this.store[0];

        this.store[0] = this.store[this.store.length - 1];
        this.store.pop();
        this.heapifyDown();

        return item;
    }

    update = (timestamp, price) => {
        let found = false;
        for(let i = 0; i < this.store.length; i++){
            if(this.store[i].timestamp === timestamp){
                this.store[i].price = price;
                found = true;
                break;
            }
        }
        if(!found){
            this.add({ timestamp, price });
        }
        this.heapifyUp();
    }

}

class MinHeapp  {
    constructor(){
        this.store = [];
    }


    getParentIndex = index => Math.floor((index - 1) / 2);
    getLeftChildIndex = index => index * 2 + 1;
    getRightChildIndex = index => index * 2 + 2;

    ifParentExists = index => (this.getParentIndex(index) >= 0);
    ifLeftChildExists = index => (this.getLeftChildIndex(index) <= this.store.length - 1);
    ifRightChildExists = index => (this.getRightChildIndex(index) <= this.store.length - 1);

    swap = (i, j) => [this.store[i], this.store[j]] = [this.store[j], this.store[i]];

    getValFromIndex = (index) => this.store[index].price;

    peek = () => this.store[0];


    heapifyDown = () => {
        let index = 0;

        while (this.ifLeftChildExists(index)) {
            let smallerChildIndex = this.getLeftChildIndex(index);

            if (this.ifRightChildExists(index) &&
                this.getValFromIndex(this.getRightChildIndex(index)) <
                this.getValFromIndex(this.getleftChildIndex(index))) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            if (this.store[smallerChildIndex] > this.store[index]) {
                break;
            } else {
                this.swap(smallerChildIndex, index);
            }

            index = smallerChildIndex;
        }


    }

    heapifyUp = () => {
        let index = this.store.length - 1;

        while (this.ifParentExists(index) &&
            this.getValFromIndex(index) <
            this.getValFromIndex(this.getParentIndex(index))) {
            this.swap(index, this.getParentIndex(index));
            index = this.getParentIndex(index);
        }
    }

    add = (el) => {
        this.store.push(el);
        this.heapifyUp();
    }

    delete = () => {
        if (this.store.length === 0) {
            return null;
        }

        const item = this.store[0];

        this.store[0] = this.store[this.store.length - 1];
        this.store.pop();
        this.heapifyDown();

        return item;
    }

    update = (timestamp, price) => {
        let found = false;
        for(let i = 0; i < this.store.length; i++){
            if(this.store[i].timestamp === timestamp){
                this.store[i].price = price;
                found = true;
                break;
            }
        }
        if(!found){
            this.add({ timestamp, price });
        }
        this.heapifyUp();
    }


}



let stockPrice = new StockPrice();

stockPrice.update(1, 10); // Timestamps are [1] with corresponding prices [10].
stockPrice.update(2, 5);  // Timestamps are [1,2] with corresponding prices [10,5].
console.log(stockPrice.current());     // return 5, the latest timestamp is 2 with the price being 5.
console.log(stockPrice.maximum());     // return 10, the maximum price is 10 at timestamp 1.
stockPrice.update(1, 3);  // The previous timestamp 1 had the wrong price, so it is updated to 3.
                          // Timestamps are [1,2] with corresponding prices [3,5].
console.log(stockPrice.maximum());     // return 5, the maximum price is 5 after the correction.
stockPrice.update(4, 2);  // Timestamps are [1,2,4] with corresponding prices [3,5,2].
console.log(stockPrice.minimum());     // return 2, the minimum price is 2 at timestamp 4.
