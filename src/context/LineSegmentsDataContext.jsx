import React, { createContext, useState } from "react";
export const LineSegmentsDataContext = createContext();

export const LineSegmentsDataProvider = ({ children }) => {
  const [renderingMethod, setRenderingMethod] = useState("Tube");
  const [radius, setRadius] = useState(0.45);
  const [tubeRes, setTubeRes] = useState(20);
  const [showCaps, setShowCaps] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [cylinderHeight, setCylinderHeight] = useState(1.0);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [intensity, setIntensity] = useState(2);
  const [color, setColor] = useState("#ffff00");
  const [renderLinesWhenMoving, setRenderLinesWhenMoving] = useState(true);

  return (
    <LineSegmentsDataContext.Provider
      value={{
        renderingMethod,
        setRenderingMethod,
        radius,
        setRadius,
        tubeRes,
        setTubeRes,
        showCaps,
        setShowCaps,
        opacity,
        setOpacity,
        cylinderHeight,
        setCylinderHeight,
        autoUpdate,
        setAutoUpdate,
        intensity,
        setIntensity,
        color,
        setColor,
        renderLinesWhenMoving,
        setRenderLinesWhenMoving,
      }}
    >
      {children}
    </LineSegmentsDataContext.Provider>
  );
};
