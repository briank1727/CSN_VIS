const jInfomap = (nds, edgs, __MIN) => {
  // A function expression can be stored in a variable. After it has been
  // stored this way, it can be used as a function. Functions stored in variables do not need
  // names. They are always invoked using the variable name.

  // Constants
  // let __MIN = 0.0000001; // Below this difference of actual versus previous modularity, Louvain algorithm iteration stops.

  // Global Variables
  let original_graph = {}; // Defined in the core() of the algorithm.
  let edge_index = {}; // edge_index[edge.source+'_'+edge.target] = ... Attributes an index to each edge. This index
  // is the position of the edge in the graph.edges array.
  let dendogram = [];

  // ----------------------------------------- Helpers -----------------------------------------
  function make_set(array) {
    // Receives an array with repeated values. Returns one filtered (and ordered) with only the different ones.
    let set = {};
    array.forEach(function (d) {
      set[d] = true;
    });

    return Object.keys(set); // Object.keys receives an array or an object. It returns an array with the respective
    // array's position or keys, respectively. Moreover, it eliminates repeated values (present in array) in the final set.
  }
  // Set -> {1: true, 2: true, 3: true...} Returns an ARRAY of the keys (each key corresponds to a node).

  function obj_values(obj) {
    let vals = [];
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        vals.push(obj[key]);
      }
    }
    return vals;
  }
  // Returns an ARRAY of the values of the input object (in the same initial order). hasOwnProperty returns true or
  // false depending on the presence of such property in obj..

  function get_degree_for_node(graph, node) {
    // Node is a number ID. Graph is an object with 3 properties (nodes,
    // edges and _assoc_mat). _assoc_mat is an object, not an array!
    let neighbours = graph._assoc_mat[node]
      ? Object.keys(graph._assoc_mat[node])
      : []; // In case we are looking
    // for a node not connected, it defines neighbours as an empty array.
    let weight = 0;
    neighbours.forEach(function (neighbour) {
      let value = graph._assoc_mat[node][neighbour] || 1;
      if (node === neighbour) {
        // In case we have already performed community aggregation, graph._assoc_mat[node][neighbour] will be different of 0.
        value *= 2;
      }
      weight += value;
    });

    return weight;
  }
  // Returns the sum of the weights of all links connecting to node.

  function get_neighbours_of_node(graph, node) {
    if (typeof graph._assoc_mat[node] === "undefined") {
      // In case we are looking for a node not connected, the
      // function returns an empty array.
      return [];
    }

    return Object.keys(graph._assoc_mat[node]); // Returns the position of each value that exists:
    // var object1 = [2,,0,0,,2] -> Array ["0", "2", "3", "5"]
  }
  // Prints an ARRAY with all neighbours of input node ID.

  function get_edge_weight(graph, node1, node2) {
    return graph._assoc_mat[node1] ? graph._assoc_mat[node1][node2] : undefined;
  }
  // Returns specific weight of the edge defined by node1 and node2.

  function get_graph_size(graph) {
    let size = 0;
    graph.edges.forEach(function (edge) {
      size += edge.weight;
    });

    return size;
  }
  // Returns the sum of the property "weight" of all edges present in graph.edges.

  function add_edge_to_graph(graph, edge) {
    // Edge is an object that specifies the source node, target node, and weight.
    update_assoc_mat(graph, edge); // Updating assoc_mat with the new edge's weight.

    if (edge_index[edge.source + "_" + edge.target]) {
      // There is no weight to update in edge_index.
      graph.edges[edge_index[edge.source + "_" + edge.target]].weight =
        edge.weight; // Because it is already in edges
      // from example.html and edge_index (because of the next part). Update the weight in graph.edges.
    } else {
      graph.edges.push(edge); // Add edge to graph.edges.
      edge_index[edge.source + "_" + edge.target] = graph.edges.length - 1; // Update edge_index with new value.
    }
  }
  // edge_index accumulates only the new edges that are added to graph.edges.

  function make_assoc_mat(edge_list) {
    let mat = {}; // It is not an array. It is a list:
    // Object { {source: 3, target: 5, weight: 1.5}, {source: 1, target: 2, weight: 1.99}, {source: 30, target: 2, weight: 3.14} ...}
    edge_list.forEach(function (edge) {
      mat[edge.source] = mat[edge.source] || {}; // Important because many edges share the same nodes. In
      // order to include an element in a 2D matrix, we need to 1st create a list to insert it.
      mat[edge.source][edge.target] = edge.weight || 1;
      mat[edge.target] = mat[edge.target] || {};
      mat[edge.target][edge.source] = edge.weight || 1;
    });
    return mat; // It is not an array (1 object containing others): Object { 1: Object { 2: 3 }, 2: Object { 2: 3 } }
  }
  // make_assoc_mat is used once in the core.edges (to create _assoc_mat). Do not forget even objects inside objects are key/value pairs.

  function update_assoc_mat(graph, edge) {
    // assoc_mat is not an array.
    graph._assoc_mat[edge.source] = graph._assoc_mat[edge.source] || {}; // In case we are updating a node without connections.
    graph._assoc_mat[edge.source][edge.target] = edge.weight;
    graph._assoc_mat[edge.target] = graph._assoc_mat[edge.target] || {};
    graph._assoc_mat[edge.target][edge.source] = edge.weight;
  }
  // Matrix where i is the source and j the target node of the respective edge. The numeric value corresponds to the edge weight.

  function clone(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    let temp = obj.constructor();

    for (let key in obj) {
      temp[key] = clone(obj[key]);
    }

    return temp;
  }
  // Copy paste operation. This is important because: I have an object x. I'd like to copy it as object y, such that changes to y do not modify x.

  function shuffle(a) {
    let j, x, i;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      x = a[i];
      a[i] = a[j];
      a[j] = x;
    }
    return a;
  }
  // Returns the input vector but randomly shuffled.

  // ----------------------------------------- Algorithm -----------------------------------------
  function init_status(graph, status) {
    // Aim of this function is to initialize network properties after Louvain
    // first execution or to update them after community aggregation.

    // Defining Status
    status["nodes_to_com"] = {}; // Nodes linked to the communities they belong. Key: Value pair. It takes the
    // value of -1 if node is not assigned to a community.
    status["internals"] = {}; // Sum of the weights of all links inside a specified community.
    status["degrees"] = {}; // Sum of the weights of the links incident in each community.
    status["gdegrees"] = {}; // Sum of the weights of the links incident in each node.
    status["loops"] = {}; // Loop weight for each node.
    status["total_weight"] = get_graph_size(graph); //  Sum of the property "weight" of all edges present in graph.

    // Goal of next if condition is to update the status features above.
    graph.nodes.forEach(function (node, i) {
      status.nodes_to_com[node] = i; // Each node belongs to a different community.
      let deg = get_degree_for_node(graph, node); // Sum of the weights of all links connecting to i.

      if (deg < 0) throw "Bad graph type, use positive weights!";

      status.degrees[i] = deg; // Sum of the weights of the links incident in each community.
      status.gdegrees[node] = deg; // Sum of the weights of the links incident in each node.
      // When every node is part of a different community, degrees = gdegrees.

      // get_edge_weight(graph, node, node) || 0
      status.loops[node] = get_edge_weight(graph, node, node) || 0; // Inner loop edge weight.
      status.internals[i] = status.loops[node]; // This condition of if should be satisfied during community aggregation phase.
      // Variable "i" is used for community assignments and "node" for node specific variables.
    });
  }

  function __mdl(status) {
    // It is possible to calculate network's modularity only using graph.status.

    let links = status.total_weight; // Total weight of the graph's edges.
    let communities = make_set(obj_values(status.nodes_to_com)); // Array with all the (non-repeated & ordered) communities present in the graph.

    // ------------------------------------------ MINIMUM DESCRIPTION LENGTH

    let nodes = make_set(Object.keys(status.nodes_to_com)); // Array with all the (non-repeated & ordered) node IDs present in the graph.

    // 3 integrating parts of the map equation.
    let mdl_a = 0;
    let mdl_b = 0;
    let mdl_d = 0;
    let mdl_c = 0;

    nodes.forEach(function (node) {
      // Iterating over each node in the network.
      let gdegree = status.gdegrees[node] || 0;
      if (links > 0) {
        mdl_c =
          mdl_c + (gdegree / (2 * links)) * Math.log(gdegree / (2 * links));
      }
    });

    communities.forEach(function (com) {
      // Iterating over each community in the network.
      let in_degree = status.internals[com] || 0; // Sum of the weights of the links inside each community.
      let degree = status.degrees[com] || 0; // Sum of the weights of the links incident in each community.

      if (links > 0) {
        mdl_b =
          mdl_b +
          ((degree - 2 * in_degree) / (2 * links)) *
            Math.log((degree - 2 * in_degree) / (2 * links));
        mdl_a = mdl_a + (degree - 2 * in_degree) / (2 * links);
        mdl_d =
          mdl_d +
          ((degree - 2 * in_degree) / (2 * links) + degree / (2 * links)) *
            Math.log(
              (degree - 2 * in_degree) / (2 * links) + degree / (2 * links)
            );
      }
    });

    return mdl_a * Math.log(mdl_a) - 2 * mdl_b - mdl_c + mdl_d; // Modularity of a given partition (defined by status).
  }

  function __neighcom(node, graph, status) {
    // Communities in the neighborhood of a given node.

    let weights = {};
    let neighborhood = get_neighbours_of_node(graph, node);

    neighborhood.forEach(function (neighbour) {
      if (neighbour !== node) {
        let weight = graph._assoc_mat[node][neighbour] || 1; // weight is a number!
        let neighbourcom = status.nodes_to_com[neighbour];
        weights[neighbourcom] = (weights[neighbourcom] || 0) + weight; // weights is an array!
      }
    });

    return weights; // Each key corresponds to a different community. The respective value is the sum of all links
    // connecting "node" to other nodes present in the respective cluster.
  }

  function __insert(node, com, weight, status) {
    // Inserting a node in community com (connected by a given weight) and modifying graph status.
    status.nodes_to_com[node] = +com; // Updating node community.
    status.degrees[com] =
      (status.degrees[com] || 0) + (status.gdegrees[node] || 0); // Updating the sum of the edges incident in community com.
    status.internals[com] =
      (status.internals[com] || 0) + weight + (status.loops[node] || 0); // Updating the sum of internal edges.
  }

  function __remove(node, com, weight, status) {
    // Removing node from community com and modifying status.
    status.degrees[com] =
      (status.degrees[com] || 0) - (status.gdegrees[node] || 0);
    status.internals[com] =
      (status.internals[com] || 0) - weight - (status.loops[node] || 0);
    status.nodes_to_com[node] = -1; // Important to renumber communities after removing an edge.
  }

  // After inserting or removing a node from a community it is fundamental to update community ID. When node is removed, it will be placed in community -1.
  function __renumber(dict) {
    // dict = status.nodes_to_com
    let count = 0;
    let ret = clone(dict); // Function output (deep copy)
    let new_values = {};
    let dict_keys = Object.keys(dict); // Getting node IDs. {1: 1, 2: 2, 3: 3...}
    dict_keys.forEach(function (key) {
      let value = dict[key]; // Node's community.
      let new_value =
        typeof new_values[value] === "undefined" ? -1 : new_values[value];
      if (new_value === -1) {
        new_values[value] = count;
        new_value = count;
        count = count + 1;
      }
      ret[key] = new_value; // {1: , 2: , 3: ,...}
    });

    return ret; // Returns an object similar to nodes_to_com. Although, each node's community is defined in an
    // ordered way like the nodes. Every single community will come across count. Communities already identified
    // in previous nodes will be assigned to future ones.
  }

  function __one_level(graph, status) {
    // Computes one level of the communities dendogram (without including community aggregation).

    let modif = true; // Modifications made in terms of community members.
    let cur_mdl = __mdl(status); // Current modularity (between -1 and 1).
    let new_mdl = cur_mdl; // New modularity value (between -1 and 1).

    while (modif) {
      // This cycle is not the one that removes or inserts nodes.
      cur_mdl = new_mdl;
      modif = false; // Only if best community is different from the actual one, the cycle may proceed.

      let shuffledNodes = shuffle(graph.nodes);

      console.log(shuffledNodes);

      shuffledNodes.forEach(function (node) {
        console.log("while");

        let com_node = status.nodes_to_com[node]; // Returning community of the input node.
        let neigh_communities = __neighcom(node, graph, status); // Returning an array of the communities in the neighborhood of input node.

        let prev_mdl = __mdl(status); // DeltaQ - Fundamental equation. This way,

        __remove(node, com_node, neigh_communities[com_node] || 0.0, status); // function __remove(node, com, weight, status) {}. Status (which
        // includes nodes_to_com) is updated (inside __remove).
        let best_com = com_node;
        let best_increase = 0;
        let neigh_communities_entries = Object.keys(neigh_communities); // Make iterable.

        // Checking whether modularity increased by inserting removed node in each neighbor community (once at a time).
        neigh_communities_entries.forEach(function (com) {
          __insert(node, com, neigh_communities[com] || 0.0, status);

          let incr = __mdl(status) - prev_mdl; // DeltaQ - Fundamental equation. This way,
          // it is only needed to calculate those 2 community specific values.

          __remove(node, com, neigh_communities[com] || 0.0, status);

          if (incr < best_increase) {
            // Only the placement of the node in the community with higher increase will remain.
            best_increase = incr;
            best_com = com; // Identifying the community the node fits the best.
          }
        });

        __insert(node, best_com, neigh_communities[best_com] || 0.0, status); // We insert the node in the
        // community there was a greater global modularity improvement. Status (which includes nodes_to_com) is updated (inside __insert).

        if (best_com !== com_node) {
          modif = true; // Only in this situation the algorithm will keep looking for new ways of
          // improving modularity (by inserting nodes into different communities).
        }
      });
      new_mdl = __mdl(status);

      if (cur_mdl - new_mdl < __MIN) {
        // Even if best_com !== com_node, if new_mdl - cur_mdl < __MIN
        // cycle is broken.
        break;
      }
    }
  }

  // Community aggregation:
  function induced_graph(partition, graph) {
    // partition has status.nodes_to_com format.
    let ret = { nodes: [], edges: [], _assoc_mat: {} }; // Output.
    let w_prec, weight;

    // Add nodes from partition values
    let partition_values = obj_values(partition); // obj_values returns an array with each node community.
    ret.nodes = ret.nodes.concat(make_set(partition_values)); // Returns an ordered array without repeated values. Inserting community aggregated nodes
    // as in the input. array1.concat(array2) -> returns an array which is array1 and array2 joined.
    graph.edges.forEach(function (edge) {
      weight = edge.weight || 1; // For every edge placed between the same 2 nodes, the final weight is summed.
      let com1 = partition[edge.source]; // Source node community.
      let com2 = partition[edge.target]; // Target node community.
      w_prec = get_edge_weight(ret, com1, com2) || 0; // get_edge_weight(graph, node1, node2) {}.
      let new_weight = w_prec + weight; // new_weight is not summing to itself.
      add_edge_to_graph(ret, {
        source: com1,
        target: com2,
        weight: new_weight,
      }); // Inserting community aggregated edges.
    });

    edge_index = {}; // Reset edge_index.

    return ret; // Returns final graph (ret) after community aggregation pass. This has updated nodes and edges.
  }

  // Partitioning drawn dendogram at an input level.
  function partition_at_level(dendogram, level) {
    let partition = clone(dendogram[0]); // partition = __renumber(status.nodes_to_com)
    for (let i = 1; i < level + 1; i++) {
      // If it is not possible to cut at the specified level, the function will
      // cut at the nearest below.
      Object.keys(partition).forEach(function (key) {
        let node = key;
        let com = partition[key];
        partition[node] = dendogram[i][com]; // CHANGE: com -> key. Once there is an init_status() before
        // partition_at_level(), it is the same. var com = partition[key];
      });
    }

    return partition; // A graph can be partitioned in different ways.
  }

  // Mother Function.
  function generate_dendogram(original_graph) {
    let status = {};

    let mdl; // Modularity before 1 level partition.
    let status_list = []; // Set of partitions at different hierarchical levels: dendogram.
    init_status(original_graph, status);
    __one_level(original_graph, status); // Computes 1 level of the communities dendogram. Current status to determine when to stop.

    let new_mdl = __mdl(status); // Modularity after 1 level partition.
    let partition = __renumber(status.nodes_to_com); // Decreasing number of communities due to __one_level.
    status_list.push(partition);
    mdl = new_mdl;
    let current_graph = induced_graph(partition, original_graph); // Graph that results from partitioning the original. Graph
    // after 1st pass. Community aggregation.

    while (true) {
      // Keeps partitioning the graph until no significant modularity increase occurs.
      init_status(current_graph, status);
      __one_level(current_graph, status);
      new_mdl = __mdl(status);
      if (mdl - new_mdl < __MIN) {
        break;
      }

      partition = __renumber(status.nodes_to_com);
      status_list.push(partition);

      mdl = new_mdl;
      current_graph = induced_graph(partition, current_graph);
    }

    return status_list; // Dendogram is a set of ordered partitions.
  }

  if (nds.length > 0) {
    original_graph = {
      // Global variable. Graph is an object with node (node), edge (edges) and weight (_assoc_mat) properties.
      nodes: nds,
      edges: edgs,
      _assoc_mat: make_assoc_mat(edgs),
    };
  }

  dendogram = generate_dendogram(original_graph); // Global variables.

  return partition_at_level(dendogram, dendogram.length - 1);
};

export default jInfomap;
