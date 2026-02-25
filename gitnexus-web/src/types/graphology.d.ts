declare module 'graphology' {
  export * from 'graphology-types';
  import type { AbstractGraph, Attributes, GraphOptions } from 'graphology-types';

  export default class Graph<
    NodeAttributes extends Attributes = Attributes,
    EdgeAttributes extends Attributes = Attributes,
    GraphAttributes extends Attributes = Attributes
  > extends AbstractGraph<NodeAttributes, EdgeAttributes, GraphAttributes> {
    constructor(options?: GraphOptions);
  }
}
