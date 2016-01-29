import rbush from 'rbush';

const toBBox = (p) => [p.x, p.y, p.x, p.y];
const compareMinX = (a, b) => a.x - b.x;
const compareMinY = (a, b) => a.y - b.y;

export default (nodeSize) => {
  const tree = rbush(nodeSize);
  tree.toBBox = toBBox;
  tree.compareMinX = compareMinX;
  tree.compareMinY = compareMinY;
  return tree;
};
