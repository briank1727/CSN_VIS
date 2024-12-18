import React, { useState, useEffect, useContext } from "react";
import {
  CustomCheckBox,
  CustomNumberInput,
  CustomSelect,
} from "../components/CustomComponents";
import {
  Button,
  Box,
  Grid2,
  Typography,
  CircularProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import DeleteIcon from "@mui/icons-material/Delete";
import { UniversalDataContext } from "../context/UniversalDataContext";
import { GraphCommunitiesDataContext } from "../context/GraphCommunitiesDataContext";
import { NearestNeighborDataContext } from "../context/NearestNeighborDataContext";
import { AdjacencyMatrixDataContext } from "../context/AdjacencyMatrixDataContext.jsx";
const NearestNeighborWorker = new Worker(
  new URL("./NearestNeighborWorker.jsx", import.meta.url),
  { type: "module" }
);
import NearestNeighborRuntime from "./NearestNeighborRuntime.jsx";

const NearestNeighborSettings = () => {
  const { segments, streamLines } = useContext(UniversalDataContext);
  const { dGraphData, setDGraphData } = useContext(GraphCommunitiesDataContext);
  const {
    treeAlgorithm,
    setTreeAlgorithm,
    k,
    setK,
    r,
    setR,
    distanceMetric,
    setDistanceMetric,
    exclude,
    setExclude,
    progress,
    setProgress,
    doSort,
    setDoSort,
    sortType,
    setSortType,
  } = useContext(NearestNeighborDataContext);

  useEffect(() => {
    if (segments && segments.length > 0) {
      if (treeAlgorithm === "KNN")
        NearestNeighborWorker.postMessage({
          constructTree: true,
          doSort: doSort,
          param: k,
          unmodifiedSegments: segments,
          treeAlgorithm: treeAlgorithm,
          distanceMetric: distanceMetric,
          unmodifiedStreamLines: streamLines,
          exclude: exclude,
          sortType: sortType,
        });
      else
        NearestNeighborWorker.postMessage({
          constructTree: true,
          doSort: doSort,
          param: r,
          unmodifiedSegments: segments,
          treeAlgorithm: treeAlgorithm,
          distanceMetric: distanceMetric,
          unmodifiedStreamLines: streamLines,
          exclude: exclude,
          sortType: sortType,
        });
    }
  }, [segments]);

  const handleSearch = async () => {
    NearestNeighborWorker.addEventListener("message", searchCallback, false);
    if (treeAlgorithm === "KNN")
      NearestNeighborWorker.postMessage({
        constructTree: false,
        doSort: doSort,
        param: k,
        unmodifiedSegments: segments,
        treeAlgorithm: treeAlgorithm,
        distanceMetric: distanceMetric,
        unmodifiedStreamLines: streamLines,
        exclude: exclude,
        sortType: sortType,
      });
    else
      NearestNeighborWorker.postMessage({
        constructTree: false,
        doSort: doSort,
        param: r,
        unmodifiedSegments: segments,
        treeAlgorithm: treeAlgorithm,
        distanceMetric: distanceMetric,
        unmodifiedStreamLines: streamLines,
        exclude: exclude,
        sortType: sortType,
      });
  };

  const searchCallback = (event) => {
    if (event.data.type == "final") {
      setProgress(100);
      NearestNeighborWorker.removeEventListener("message", searchCallback);
      setDGraphData(event.data.tgraph);
    } else if (event.data.type == "progress") {
      setProgress(event.data.progress);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <CustomSelect
          name={"Algorithm"}
          onChange={(e) => setTreeAlgorithm(e.target.value)}
          defaultValue={treeAlgorithm}
          options={[
            { value: "KNN", label: "KNN" },
            { value: "RBN", label: "RBN" },
          ]}
        />
        {treeAlgorithm === "RBN" && (
          <CustomNumberInput
            name={"Radius (Proportion from 0 to 1)"}
            onChange={(e) => setR(e.target.value)}
            defaultValue={r}
          />
        )}
        {treeAlgorithm === "KNN" && (
          <CustomNumberInput
            name={"Number of Neighbors (K)"}
            onChange={(e) => setK(e.target.value)}
            defaultValue={k}
          />
        )}
        <CustomSelect
          name={"Distance"}
          onChange={(e) => setDistanceMetric(e.target.value)}
          defaultValue={distanceMetric}
          options={[
            { value: "shortest", label: "Shortest" },
            { value: "longest", label: "Longest" },
            { value: "haustoff", label: "Haustoff" },
          ]}
        />
        <CustomSelect
          name={"Sort Type"}
          onChange={(e) => setSortType(e.target.value)}
          defaultValue={sortType}
          options={[
            { value: 1, label: "Row Sum" },
            { value: 2, label: "Average Distance" },
          ]}
        />
        <CustomCheckBox
          name={"Exclude"}
          onChange={(e) => setExclude(e.target.checked)}
          defaultValue={exclude}
        />
        {/* <CustomCheckBox
          name={"Do Sort"}
          onChange={(e) => setDoSort(e.target.checked)}
          defaultValue={doSort}
        /> */}
        <LoadingButton
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<PlayArrowIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={handleSearch}
          loading={progress != 0 && progress != 100}
          loadingIndicator={
            <CircularProgress
              variant="determinate"
              value={progress}
              size={20}
            />
          }
        >
          Start
        </LoadingButton>
        <Button
          component="label"
          variant="contained"
          tabIndex={-1}
          startIcon={<DeleteIcon />}
          fullWidth
          sx={{ flexGrow: 1 }}
          onClick={() => setDGraphData([])}
          disabled={dGraphData.length === 0}
        >
          Delete Tree
        </Button>
        {treeAlgorithm === "KNN" && (
          <Typography
            variant="h5"
            textAlign="center"
            fontWeight="bold"
            sx={{ width: "100%" }}
          >
            Predicted Runtime:{" "}
            {Math.ceil(NearestNeighborRuntime(segments.length, k) / 100) / 10}{" "}
            seconds
          </Typography>
        )}
      </Grid2>
    </Box>
  );
};

export default NearestNeighborSettings;
