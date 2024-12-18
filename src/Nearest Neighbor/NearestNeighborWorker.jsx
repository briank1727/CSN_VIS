import {
  findRBN,
  findRBN2,
  computeDiagonalLength,
  computeBounds,
  createLineSegmentKDTree,
  findKNearestNeighbors,
  processSegments,
  distance3D,
} from "./knnHelper";

// Brian: Store the tree and lineSegments in memory
let tree = null;
let lineSegments = null;

function rearrangeMatrix(matrix) {
  // Validate the input is a square matrix
  const size = matrix.length;
  for (const row of matrix) {
    if (row.length !== size) {
      throw new Error("The input matrix must be square and symmetric.");
    }
  }

  // Compute the distance of each row from the diagonal element
  const rowDistances = matrix.map((row, i) => {
    return row.reduce((distance, value, j) => {
      return distance + Math.abs(i - j) * value;
    }, 0);
  });

  // Create an array of row indexes
  const rowIndexes = Array.from({ length: size }, (_, i) => i);

  // Sort the row indexes based on the row distances
  rowIndexes.sort((a, b) => rowDistances[a] - rowDistances[b]);

  return rowIndexes;
}

self.addEventListener("message", (event) => {
  let {
    constructTree,
    doSort,
    param,
    unmodifiedSegments,
    treeAlgorithm,
    distanceMetric,
    exclude,
    unmodifiedStreamLines,
    sortType,
  } = event.data;

  // Precompute the tree once the segments are uploaded
  let startTime, endTime;
  if (constructTree) {
    startTime = performance.now();
    lineSegments = processSegments(unmodifiedSegments);
    tree = createLineSegmentKDTree(lineSegments);
    endTime = performance.now();
    console.log(
      `Tree Construction Time: ${(endTime - startTime).toFixed(2)} ms`
    );
    return;
  }

  // If the tree or lineSegments aren't precomputed for some reason, compute them
  // In theory these lines should never run since there would be preprocessing on the same cpu thread
  if (!lineSegments) lineSegments = processSegments(unmodifiedSegments);
  if (!tree) createLineSegmentKDTree(lineSegments);

  startTime = performance.now();

  let streamlines = unmodifiedStreamLines;
  let segments = unmodifiedSegments;
  if (doSort)
    streamlines.map((sl) => {
      sl.push(0);
      return sl;
    });

  let KR = Number(param);
  if (treeAlgorithm == "RBN") {
    const bounds = computeBounds(lineSegments);
    KR = KR * computeDiagonalLength(bounds);
  }
  let tgraph = [];

  let lastProgress = 0;
  let pixels = [];

  const matrix = Array(streamlines.length)
    .fill()
    .map(() => Array(streamlines.length).fill(0));

  for (let i = 0; i < lineSegments.length; i++) {
    //for (let i=0; i <  2; i++){
    const segment = lineSegments[i];
    const fun = treeAlgorithm == "RBN" ? findRBN2 : findKNearestNeighbors;

    let funRes = fun(tree, segment, lineSegments, KR, distanceMetric);
    let neighbors = funRes[0];

    if (exclude > 0 && treeAlgorithm == "KNN") {
      let excluded = 0;
      const sIdx = segments[i].globalIdx;
      neighbors.forEach((n) => {
        if (
          Math.abs(n - sIdx) <= exclude &&
          segments[i].lineIDx == segments[n].lineIDx
        )
          excluded += 1;
      });
      funRes = fun(tree, segment, lineSegments, KR + excluded, distanceMetric);
      let neighbors = funRes[0];
    }

    if (exclude > 0) {
      neighbors = neighbors.filter((n) => {
        const sIdx = segments[i].globalIdx;
        return (
          Math.abs(n - sIdx) > exclude ||
          segments[i].lineIDx != segments[n].lineIDx
        );
      });
    }

    if (!doSort) {
      tgraph.push(neighbors);
    }

    const progress = Math.floor((i / lineSegments.length) * 100);
    if (progress % 10 === 0 && progress !== lastProgress) {
      lastProgress = progress;
      self.postMessage({
        type: "progress",
        progress: progress,
      });
    }
  }

  if (doSort) {
    const indexes = rearrangeMatrix(matrix);
    if (sortType == 1)
      streamlines = indexes.map((newIndex) => streamlines[newIndex]);
    else
      streamlines = streamlines.sort((a, b) => {
        return a[2] - b[2];
      });

    tgraph = [];
    lastProgress = 0;
    pixels = [];
    const segments2 = [];
    let lIdx = 0;
    streamlines = streamlines.map((sl) => {
      const startIdx = segments2.length;
      for (let i = sl[0]; i <= sl[1]; i++) {
        if (!segments[i]) {
          //console.log(segments[i],i);
          continue;
        }
        const seg = segments[i];
        seg.globalIdx = segments2.length;
        seg.lineIDx = lIdx;
        segments2.push(seg);
      }
      const endIdx = segments2.length - 1;
      lIdx++;
      //console.log(startIdx,endIdx);
      return [startIdx, endIdx];
    });

    //console.log(streamlines);
    //console.log(segments.length, segments2.length);
    segments = segments2;
    //
    lineSegments = processSegments(segments);
    tree = createLineSegmentKDTree(lineSegments);
    for (let i = 0; i < lineSegments.length; i++) {
      //for (let i=0; i <  2; i++){
      const segment = lineSegments[i];
      const fun = treeAlgorithm == "RBN" ? findRBN2 : findKNearestNeighbors;

      let neighbors = fun(tree, segment, lineSegments, KR, distanceMetric);
      if (exclude > 0 && treeAlgorithm == "KNN") {
        let excluded = 0;
        const sIdx = segments[i].globalIdx;
        neighbors.forEach((n) => {
          if (
            Math.abs(n - sIdx) <= exclude &&
            segments[i].lineIDx == segments[n].lineIDx
          )
            excluded += 1;
        });
        //console.log(excluded);
        neighbors = fun(
          tree,
          segment,
          lineSegments,
          KR + excluded,
          distanceMetric
        );
      }

      if (exclude > 0) {
        neighbors = neighbors.filter((n) => {
          const sIdx = segments[i].globalIdx;
          return (
            Math.abs(n - sIdx) > exclude ||
            segments[i].lineIDx != segments[n].lineIDx
          );
        });
      }
      tgraph.push(neighbors);
      neighbors.forEach((n, idx) => {
        //segments[n].color = 'blue';
        pixels.push([i, n]);
        //pixels.push([n,i]);
      });

      const progress = Math.floor((i / lineSegments.length) * 100);
      if (progress % 10 === 0 && progress !== lastProgress) {
        //setProgress(progress);
        lastProgress = progress;
        self.postMessage({
          type: "progress",
          progress: progress,
        });
        //console.log(progress);
      }
    }
  }

  endTime = performance.now();
  console.log(`Neighbor Search Time: ${(endTime - startTime).toFixed(2)} ms`);

  const msg = {
    type: "final",
    tgraph: tgraph,
    pixels: pixels,
  };
  if (doSort) {
    msg.segments = segments;
    msg.streamlines = streamlines;
  }
  self.postMessage(msg);
});
