import React, { useState, useEffect, useContext } from "react";

import seedrandom from "seedrandom";

import {
  CustomNumberInput,
  CustomCheckBox,
  CustomSelect,
} from "../components/CustomComponents";
import {
  Box,
  Typography,
  Grid2,
  Button,
  CircularProgress,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UndoIcon from "@mui/icons-material/Undo";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import { UniversalDataContext } from "../context/UniversalDataContext";
const GraphCommunityWorker = new Worker(
  new URL("./GraphCommunityWorker.jsx", import.meta.url),
  { type: "module" }
);
const GraphCommunitiesSettings = ({
  multiSelect,
  setMultiSelect,
  nodeScale,
  setNodeScale,
  dGraphData,
  setDGraphData,
  isEmpty,
  setIsEmpty,
  selectedNodes,
  communityAlgorithm,
  setCommunityAlgorithm,
  graphData,
  setGraphData,
  allGroups,
  setAllGroups,
}) => {
  const { segments, selectedSegments } = useContext(UniversalDataContext);
  const [seed, setSeed] = useState(1);
  const [inputs, setInputs] = useState({
    resolution: 1,
    randomWalk: false,
    min: 0.01,
    gamma: 0.1,
    max: 10,
    dims: 5,
    kmean: 8,
  });
  const [running, setRunning] = useState(false);
  const [undoState, setUndoState] = useState(false);
  const [orgCommunities, setOrgCommunities] = useState({
    nodes: [],
    links: [],
  });

  useEffect(() => {
    GraphCommunityWorker.postMessage({
      functionType: "preCompute",
      dGraphData: dGraphData,
    });
  }, [dGraphData]);

  const handleStart = async () => {
    if (isEmpty) return; // Do not attempt to plot if the graph is empty

    GraphCommunityWorker.addEventListener(
      "message",
      createGraphCallback,
      false
    );
    GraphCommunityWorker.postMessage({
      functionType: "createGraph",
      dGraphData: dGraphData,
      segments: segments,
      inputs: inputs,
      communityAlgorithm: communityAlgorithm,
      seed: seed,
    });

    setRunning(true);
  };

  const createGraphCallback = (event) => {
    setRunning(false);

    GraphCommunityWorker.removeEventListener("message", createGraphCallback);
    setOrgCommunities(event.data.communities);
    setGraphData({
      //nodes,
      nodes: event.data.nodesWithCommunityMembers,
      links: event.data.interCommunityLinks, //[], // No inter-community links for this simplified visualization
    });

    setUndoState(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs({
      ...inputs,
      [name]: type === "checkbox" ? checked : parseFloat(value),
    });
  };

  const handleUndo = (data = false) => {
    if (!undoState) return;
    if (!data) data = undoState;
    else setUndoState(data);

    const undo = JSON.parse(data);
    setGraphData(undo.graphData);
    setOrgCommunities(undo.orgCommunities);
    setMultiSelect(undo.multiSelect);
    setAllGroups(undo.allGroups);
    setUndoState(undo.prevUndo);
  };

  const saveUndo = () => {
    const nlinks = graphData.links.map((obj) => ({
      source: obj.source.id,
      target: obj.target.id,
    }));

    const sGraphData = {
      nodes: graphData.nodes,
      links: nlinks,
    };

    const undo = {
      prevUndo: undoState,
      graphData: sGraphData,
      orgCommunities,
      isEmpty,
      selectedNodes,
      multiSelect,
      allGroups,
    };

    setUndoState(JSON.stringify(undo));
  };

  const handleSplitCommunity = (splitInto = null) => {
    GraphCommunityWorker.addEventListener(
      "message",
      splitCommunityCallback,
      false
    );
    GraphCommunityWorker.postMessage({
      functionType: "splitCommunity",
      communityAlgorithm: communityAlgorithm,
      dGraphData: dGraphData,
      graphData: graphData,
      splitInto: splitInto,
      selectedSegments: selectedSegments,
      orgCommunities: orgCommunities,
      selectedNodes: selectedNodes,
      inputs: inputs,
    });
  };

  const splitCommunityCallback = (event) => {
    GraphCommunityWorker.removeEventListener("message", splitCommunityCallback);
    const { newGroups, newOrgCommunities, newGraphData } = event.data;
    saveUndo();
    updateGroups(newGroups);
    setOrgCommunities(newOrgCommunities);
    setGraphData(newGraphData);
  };

  const updateGroups = (nodes) => {
    const groups = {};

    nodes.forEach((node) => {
      if (Array.isArray(node.groupID)) {
        //console.log(node.groupID)
        node.groupID = [...new Set(node.groupID)];
        node.groupID.forEach((groupID) => {
          if (groups.hasOwnProperty(groupID)) {
            groups[groupID]++; // Increment the frequency if the key exists
          } else {
            groups[groupID] = 1; // Initialize the frequency if the key doesn't exist
          }
        });
      }
    });

    computeSizes(nodes);
    //console.log(groups)
    console.log("GROUPS: ", groups);
    setAllGroups(groups);
    return groups;
  };

  const computeSizes = (nodes) => {
    // Find min and max number of members
    let minMembers = Infinity,
      maxMembers = -Infinity;
    nodes.forEach((node) => {
      minMembers = Math.min(minMembers, node.members.length);
      maxMembers = Math.max(maxMembers, node.members.length);
    });

    // Define the log base - using e (natural logarithm) for simplicity
    const logBase = Math.E;

    // Function to calculate size based on members count
    const logScaleSize = (membersCount, a, b) => {
      return a + (b * Math.log(membersCount)) / Math.log(logBase);
    };

    // Calculate constants a and b for the scale
    // Solve for a and b using the equations for min and max members
    const b = 9 / (Math.log(maxMembers) - Math.log(minMembers)); // (10 - 1) = 9 is the range of sizes
    const a = 1 - b * Math.log(minMembers);

    // Calculate and assign sizes
    nodes.forEach((node) => {
      node.size = logScaleSize(node.members.length, a, b);
      // Ensure size is within bounds
      node.size = Math.max(1, Math.min(node.size, 10));
    });

    return nodes;
  };

  useEffect(() => {
    setIsEmpty(dGraphData.every((arr) => arr.length === 0));
  }, [dGraphData]);

  const renderInputs = () => {
    switch (communityAlgorithm) {
      case "Louvain":
      case "Louvain-SL":
        return (
          <>
            <CustomNumberInput
              name={"Resolution"}
              onChange={handleInputChange}
              defaultValue={inputs.resolution}
              isDynamic={false}
            />
            <CustomCheckBox
              name={"Random Walk"}
              onChange={handleInputChange}
              defaultValue={inputs.randomWalk}
              isDynamic={false}
            />
          </>
        );
      case "PCA":
        return (
          <>
            <CustomNumberInput
              name={"Dims"}
              onChange={handleInputChange}
              defaultValue={inputs.dims}
            />

            <CustomNumberInput
              name={"K Means"}
              onChange={handleInputChange}
              defaultValue={inputs.kmean}
            />
          </>
        );
      case "Infomap":
        return (
          <CustomNumberInput
            name={"Min"}
            onChange={handleInputChange}
            defaultValue={inputs.min}
          />
        );
      case "Hamming Distance":
        return (
          <CustomNumberInput
            name={"Min"}
            onChange={handleInputChange}
            defaultValue={inputs.min}
          />
        );
      case "Blank":
        return <></>;
      case "Label Propagation":
        return (
          <>
            <CustomNumberInput
              name={"Gamma"}
              onChange={handleInputChange}
              defaultValue={inputs.gamma}
            />
            <CustomNumberInput
              name={"Max"}
              onChange={handleInputChange}
              defaultValue={inputs.max}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid2 container spacing={1}>
        <Typography sx={{ fontWeight: "bold" }}>
          Graph Community Settings
        </Typography>

        <Grid2 container size={12} spacing={2}>
          <Grid2 size={6}>
            <CustomSelect
              name={"Community Algorithm"}
              onChange={(e) => setCommunityAlgorithm(e.target.value)}
              defaultValue={communityAlgorithm}
              options={[
                { value: "Louvain", label: "Louvain" },
                { value: "Louvain-SL", label: "Louvain-SL" },
                { value: "PCA", label: "PCA K-Means" },
                { value: "Infomap", label: "Infomap" },
                {
                  value: "Label Propagation",
                  label: "Label Propagation",
                },
                { value: "Hamming Distance", label: "Hamming Distance" },
                { value: "Blank", label: "Blank" },
              ]}
            />
            <CustomNumberInput
              name={"Node Scale"}
              onChange={(e) => setNodeScale(Number(e.target.value))}
              defaultValue={nodeScale}
            />
            <CustomNumberInput
              name={"Seed"}
              onChange={(e) => {
                setSeed(Number(e.target.value));
                seedrandom(seed, { global: true });
              }}
              defaultValue={seed}
            />
          </Grid2>
          <Grid2 size={6}>{renderInputs()}</Grid2>
        </Grid2>

        <Grid2 container size={12} spacing={2}>
          <Grid2 size={4.5}></Grid2>
          <Grid2
            size={3}
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <Button
              component="label"
              variant="contained"
              tabIndex={-1}
              startIcon={<PlayArrowIcon />}
              fullWidth
              disabled={isEmpty}
              sx={{ flexGrow: 1 }}
              onClick={handleStart}
            >
              Start
            </Button>
          </Grid2>
          <Grid2
            size={4.5}
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "center",
            }}
          >
            {running && <CircularProgress size={20} />}
          </Grid2>
        </Grid2>

        <Grid2 container spacing={1}>
          <Button
            component="label"
            variant="contained"
            tabIndex={-1}
            startIcon={<UndoIcon />}
            onClick={() => handleUndo()}
            disabled={!undoState}
          >
            Undo
          </Button>
          <Button
            component="label"
            variant="contained"
            tabIndex={-1}
            startIcon={<CallSplitIcon />}
            onClick={() => handleSplitCommunity()}
            disabled={selectedNodes.length !== 1}
          >
            Split
          </Button>
        </Grid2>
      </Grid2>
    </Box>
  );
};

export default GraphCommunitiesSettings;
