import RBTree, { Node } from './RBTree';

abstract class RBIterator {
    protected tree: RBTree;
    protected lastValue: number;
    protected stack: Node[];

    constructor(t: RBTree) {
        this.tree = t;
        this.restart();
    }
    public abstract restart();
    public abstract next(): Node;
    public hasNext(): boolean {
        return this.stack.length > 0;
    }
    protected abstract stackTryPush(node);
}

export class MinRBIterator<T = any> extends RBIterator {
    public restart() {
        this.stack = [];
        this.lastValue = undefined;
        let minNode = this.tree.getMinNode();
        if (!this.tree.isTnull(minNode)) this.stack.push(minNode);
    }

    protected stackTryPush(node) {
        if (!this.tree.isTnull(node) && node.key > this.lastValue) this.stack.push(node);
    }

    public next(): Node<T> {
        let node: Node;
        if (this.stack.length) {
            node = this.stack.pop();
            node = this.tree.findMinimum(node, this.lastValue);

            //obrada
            this.lastValue = node.key;

            //try push parent
            this.stackTryPush(node.parent);

            //try push right
            this.stackTryPush(node.right);
            return node;
        }
        return null;
    }
}
export class MaxRBIterator<T = any> extends RBIterator {
    public restart() {
        this.stack = [];
        this.lastValue = undefined;
        let maxNode = this.tree.getMaxNode();
        if (!this.tree.isTnull(maxNode)) this.stack.push(maxNode);
    }

    protected stackTryPush(node) {
        if (!this.tree.isTnull(node) && node.key < this.lastValue) this.stack.push(node);
    }
    public next(): Node<T> {
        let node: Node;
        if (this.stack.length) {
            node = this.stack.pop();
            node = this.tree.findMaximum(node, this.lastValue);

            //obrada
            this.lastValue = node.key;

            //try push parent
            this.stackTryPush(node.parent);

            //try push left
            this.stackTryPush(node.left);

            return node;
        }
        return null;
    }
}
export default RBIterator;
