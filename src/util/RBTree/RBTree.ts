import { MaxRBIterator, MinRBIterator } from './Iterator';

enum nodeColor {
    RED = 0,
    BLACK = 1,
}

const toNumber = (str: string): number => {
    if (str.length <= 0) throw new Error('toString - string length <= 0');
    let number = 0;
    for (let c of str) {
        number += c.charCodeAt(0);
    }
    return number;
};

export class Node<vType = any> {
    public key: number;
    public value: vType;
    public color: nodeColor;
    public parent: Node<vType>;
    public left: Node<vType>;
    public right: Node<vType>;

    constructor(
        key: number,
        value: any,
        color?: nodeColor,
        parent?: Node<vType>
    ) {
        this.key = key;
        this.value = value;
        this.color = color;
        this.parent = parent;
        //left = right = undefined
    }
}

class RBTree<Type = any> {
    private root: Node<Type>;
    private Tnull: Node<Type>;

    // O(1) lookup - modified RBTree
    private minNode: Node<Type>;
    private maxNode: Node<Type>;

    constructor() {
        this.Tnull = new Node(null, null, nodeColor.BLACK);
        this.root = this.Tnull;
        this.minNode = this.Tnull;
        this.maxNode = this.Tnull;
    }

    public isTnull(node: Node<Type>): boolean {
        return node == this.Tnull;
    }
    /**
     *      node                   l
     *      /  \                 /   \
     *     l Gamma   ====>   alpha  node
     *   /  \                        /  \
     * alpha beta                 beta  Gamma
     */
    private rotateRight(node: Node<Type>): void {
        try {
            let l = node.left;
            let beta = l.right;

            if (!this.isTnull(beta)) beta.parent = node;
            l.parent = node.parent;
            if (this.isTnull(node.parent)) this.root = l;
            else if (node.parent.left == node) {
                node.parent.left = l;
            } else if (node.parent.right == node) {
                node.parent.right = l;
            }
            l.right = node;
            node.parent = l;
            node.left = beta;
        } catch (e) {
            console.log('Error - right rotate');
        }
    }
    /**
     *     node                r
     *     /  \               / \
     * alpha   r   ====>    node Gamma
     *        / \           / \
     *     beta Gamma    alpha beta
     */
    private rotateLeft(node: Node<Type>) {
        try {
            let r = node.right;
            let beta = r.left;

            if (!this.isTnull(beta)) beta.parent = node;
            r.parent = node.parent;
            if (this.isTnull(node.parent)) this.root = r;
            else if (node.parent.left == node) {
                node.parent.left = r;
            } else if (node.parent.right == node) {
                node.parent.right = r;
            }
            r.left = node;
            node.parent = r;
            node.right = beta;
        } catch (e) {
            console.log('Error - left rotate');
        }
    }

    public insert(key: number | string, value: Type) {
        if (typeof key === 'string') {
            key = toNumber(key); //type guard
        }
        this._insert(key, value);
    }

    private _insert(key: number, value: Type): void {
        let current: Node<Type> = this.root;
        let previous: Node<Type>;
        if (this.isTnull(this.root)) {
            this.root = new Node<Type>(key, value, nodeColor.BLACK);
            this.root.left = this.Tnull;
            this.root.right = this.Tnull;
            this.root.parent = this.Tnull;
            this.minNode = this.root;
            this.maxNode = this.root;
            return;
        }
        //find where to insert or update value if key already exists
        let onlyLeft = true;
        let onlyRight = true;
        while (!this.isTnull(current)) {
            previous = current;
            if (key == current.key) {
                current.value = value;
                return;
            }
            if (key < current.key) {
                onlyRight = false;
                current = current.left;
                continue;
            }
            onlyLeft = false;
            current = current.right;
        }
        //current is some leaf node and previous is the parent
        let node = new Node(key, value, nodeColor.RED, previous);
        if (onlyLeft) this.minNode = node;
        if (onlyRight) this.maxNode = node;
        node.left = this.Tnull;
        node.right = this.Tnull;

        if (key < previous.key) previous.left = node;
        else previous.right = node;
        this.fixInsert(node);
    }

    private fixInsert(node: Node<Type>) {
        let uncle: Node<Type>;
        let grandpa: Node<Type>;
        while (node.parent.color == nodeColor.RED) {
            grandpa = node.parent.parent;
            if (node.parent == grandpa.right) {
                uncle = grandpa.left;
                if (uncle.color == nodeColor.RED) {
                    uncle.color = nodeColor.BLACK;
                    node.parent.color = nodeColor.BLACK;
                    grandpa.color = nodeColor.RED;
                    node = grandpa;
                    continue;
                }
                //uncle is black or null
                if (node == node.parent.left) {
                    //double roration needed
                    node = node.parent;
                    this.rotateRight(node);
                }
                node.parent.color = nodeColor.BLACK;
                node.parent.parent.color = nodeColor.RED;
                this.rotateLeft(node.parent.parent);
            } else {
                //node.parent == grandpa.left
                uncle = grandpa.right;
                if (uncle.color == nodeColor.RED) {
                    uncle.color = nodeColor.BLACK;
                    node.parent.color = nodeColor.BLACK;
                    grandpa.color = nodeColor.RED;
                    node = grandpa;
                    continue;
                }
                //uncle is black or null
                if (node == node.parent.right) {
                    //double roration needed
                    node = node.parent;
                    this.rotateLeft(node);
                }
                node.parent.color = nodeColor.BLACK;
                node.parent.parent.color = nodeColor.RED;
                this.rotateRight(node.parent.parent);
            }
        }
        this.root.color = nodeColor.BLACK;
    }
    public delete(key: number | string) {
        if (typeof key === 'string') {
            key = toNumber(key); //type guard
        }
        this._delete(key);
    }

    private _delete(key: number) {
        let current = this.root;
        while (!this.isTnull(current)) {
            if (key == current.key) break;
            if (key < current.key) {
                current = current.left;
                continue;
            }
            if (key > current.key) {
                current = current.right;
                continue;
            }
        }
        if (this.isTnull(current)) return;

        if (current == this.minNode) {
            this.minNode = this.findNextMinimum();
        }
        if (current == this.maxNode) {
            this.maxNode = this.findNextMaximum();
        }

        let removedCollor = current.color;
        let startFixNode: Node<Type>;

        //Single right child
        if (this.isTnull(current.left)) {
            startFixNode = current.right;
            this.transplant(current, current.right);
        }
        //Single left child
        else if (this.isTnull(current.right)) {
            startFixNode = current.left;
            this.transplant(current, current.left);
        }
        //Two children
        else {
            let inOrderSuccessor: Node<Type>;
            inOrderSuccessor = this.findMinimum(current.right);
            removedCollor = inOrderSuccessor.color;
            startFixNode = inOrderSuccessor.right;
            if (inOrderSuccessor.parent == current) {
                startFixNode.parent = inOrderSuccessor;
            } else {
                this.transplant(inOrderSuccessor, inOrderSuccessor.right);
                inOrderSuccessor.right = current.right;
                inOrderSuccessor.right.parent = inOrderSuccessor;
            }
            this.transplant(current, inOrderSuccessor);
            inOrderSuccessor.left = current.left;
            inOrderSuccessor.left.parent = inOrderSuccessor;
            inOrderSuccessor.color = current.color;
        }
        if (removedCollor == nodeColor.BLACK) {
            this.fixDelete(startFixNode);
        }
    }

    private fixDelete(node: Node<Type>) {
        while (node != this.root && node.color == nodeColor.BLACK) {
            if (node == node.parent.left) {
                let sibling = node.parent.right;
                if (sibling.color == nodeColor.RED) {
                    sibling.color = nodeColor.BLACK;
                    node.parent.color = nodeColor.RED;
                    this.rotateLeft(node.parent);
                    sibling = node.parent.right;
                }
                if (
                    sibling.left.color == nodeColor.BLACK &&
                    sibling.right.color == nodeColor.BLACK
                ) {
                    sibling.color = nodeColor.RED;
                    node = node.parent;
                } else {
                    if (sibling.right.color == nodeColor.BLACK) {
                        sibling.left.color = nodeColor.BLACK;
                        sibling.color = nodeColor.RED;
                        this.rotateRight(sibling);
                        sibling = node.parent.right;
                    }
                    sibling.color = node.parent.color;
                    node.parent.color = nodeColor.BLACK;
                    sibling.right.color = nodeColor.BLACK;
                    this.rotateLeft(node.parent);
                    node = this.root;
                }
            } else {
                let sibling = node.parent.left;
                if (sibling.color == nodeColor.RED) {
                    sibling.color = nodeColor.BLACK;
                    node.parent.color = nodeColor.RED;
                    this.rotateRight(node.parent);
                    sibling = node.parent.left;
                }
                if (
                    sibling.left.color == nodeColor.BLACK &&
                    sibling.right.color == nodeColor.BLACK
                ) {
                    sibling.color = nodeColor.RED;
                    node = node.parent;
                } else {
                    if (sibling.left.color == nodeColor.BLACK) {
                        sibling.right.color = nodeColor.BLACK;
                        sibling.color = nodeColor.RED;
                        this.rotateLeft(sibling);
                        sibling = node.parent.left;
                    }
                    sibling.color = node.parent.color;
                    node.parent.color = nodeColor.BLACK;
                    sibling.left.color = nodeColor.BLACK;
                    this.rotateRight(node.parent);
                    node = this.root;
                }
            }
        }
        node.color = nodeColor.BLACK;
    }

    // Parent -> newNode
    // newNode.parent -> Parent
    // oldNode childer != newNode childer
    private transplant(oldNode: Node<Type>, newNode: Node<Type>) {
        if (this.isTnull(oldNode.parent)) {
            this.root = newNode;
        } else if (oldNode.parent.left == oldNode) {
            oldNode.parent.left = newNode;
        } else if (oldNode.parent.right == oldNode) {
            oldNode.parent.right = newNode;
        } else {
            throw new Error('Node is not a child of its parrent');
        }
        //unconditional since TNull
        newNode.parent = oldNode.parent;
    }
    //Find succesor of the MINIMUM node - not in the general case
    private findNextMinimum() {
        let node = this.minNode;
        let min = this.findMinimum(node.right);
        if (!this.isTnull(min) && min != node) return min;
        min = node.parent;
        return min;
    }
    // returns the left most node larger than 'value'
    public findMinimum(node: Node<Type>, value?: number): Node<Type> {
        if (this.isTnull(node)) return this.Tnull;
        while (!this.isTnull(node.left) && (!value || value < node.left.key)) {
            node = node.left;
        }
        return node;
    }

    //Find predeccesor of the MAXIMUM node - not in the general case
    private findNextMaximum() {
        let node = this.maxNode;
        let max = this.findMaximum(node.left);
        if (!this.isTnull(max) && max != node) return max;
        max = node.parent;
        return max;
    }

    // returns the right most node less than 'value'
    public findMaximum(node: Node<Type>, value?: number): Node<Type> {
        if (this.isTnull(node)) return this.Tnull;
        while (
            !this.isTnull(node.right) &&
            (!value || value > node.right.key)
        ) {
            node = node.right;
        }
        return node;
    }

    public getMinNode(): Node<Type> {
        return this.minNode;
    }

    public getMaxNode(): Node<Type> {
        return this.maxNode;
    }

    public getMinIterator(): MinRBIterator<Type> {
        return new MinRBIterator<Type>(this);
    }
    public getMaxIterator(): MaxRBIterator<Type> {
        return new MaxRBIterator<Type>(this);
    }

    public checkIntegrity(): boolean {
        let n = this.traverse(this.root, 0, nodeColor.RED);
        return n >= 0;
    }

    private traverse(
        node: Node<Type>,
        maxBlack: number,
        parrentCollor: nodeColor
    ): number {
        if (this.isTnull(node)) return maxBlack;
        if (node.color == nodeColor.RED && parrentCollor == nodeColor.RED) {
            console.log('Double red', node);
            return -1;
        }
        let l = this.traverse(node.left, maxBlack, node.color);
        let r = this.traverse(node.right, maxBlack, node.color);
        if (l == -1 || l != r) {
            console.log('Blacks not even', node);
            return -1;
        }
        maxBlack = l;
        if (node.color == nodeColor.BLACK) maxBlack++;
        return maxBlack;
    }

    public printTree() {
        this.printPreorder(this.root);
    }
    public printBFS() {
        let queue = [];
        queue.push({ node: this.root, lvl: 0 });
        let lvl = 0;
        while (queue.length) {
            let current = queue.shift();
            if (this.isTnull(current.node)) continue;
            // console.log("%c HELLLO","color:red")
            if (current.node.color == nodeColor.BLACK)
                process.stdout.write('\x1b[37m');
            else process.stdout.write('\x1b[31m');

            if (current.lvl == lvl) {
                if (lvl != 0) process.stdout.write('   ');
            } else {
                lvl = current.lvl;
                console.log('');
            }
            process.stdout.write('' + current.node.key);

            queue.push({ node: current.node.left, lvl: current.lvl + 1 });
            queue.push({ node: current.node.right, lvl: current.lvl + 1 });
        }
        //RESET TERMINAL
        process.stdout.write('\x1b[0m');
        console.log('');
        console.log('');
    }
    private printPreorder(node: Node<Type>) {
        if (this.isTnull(node)) return;
        console.log(
            node.key,
            ' - ',
            node.color == nodeColor.BLACK ? 'Black' : 'Red'
        );
        this.printPreorder(node.left);
        this.printPreorder(node.right);
    }
}

export default RBTree;
