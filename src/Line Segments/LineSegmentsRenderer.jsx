import React, {
  useCallback,
  useRef,
  useEffect,
  useState,
  useContext,
} from "react";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
extend({ LineSegments2 });
import * as THREE from "three";
import { TrackballControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
extend({ TrackballControls });

import { UniversalDataContext } from "../context/UniversalDataContext";
import { LineSegmentsDataContext } from "../context/LineSegmentsDataContext";

import { Typography } from "@mui/material";

const DirectionalLightWithCamera = ({ intensity }) => {
  const directionalLightRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (directionalLightRef.current && camera) {
      //console.log("synced")
      directionalLightRef.current.position.copy(camera.position);
      directionalLightRef.current.rotation.copy(camera.rotation);
    }
  });

  return <directionalLight ref={directionalLightRef} intensity={intensity} />;
};

const LineSegmentsRenderer = () => {
  const { segments } = useContext(UniversalDataContext);
  return (
    <>
      <Typography
        sx={{
          position: "absolute",
          fontWeight: "bold",
          zIndex: 10,
          top: 10,
          left: 10,
        }}
      >
        Line Segments{" "}
      </Typography>
      <Typography
        sx={{
          position: "absolute",
          zIndex: 10,
          top: 40,
          left: 10,
          fontWeight: "bold",
          fontSize: 12,
        }}
      >
        {segments &&
          segments.length === 0 &&
          "Upload a File to Render Line Segments"}
      </Typography>
      <Canvas style={{ width: "100%", height: "100%" }}>
        <LineSegmentsCanvas />
      </Canvas>
    </>
  );
};

const LineSegmentsCanvas = () => {
  const { segments, selectedSegments, setSelectedSegments, coloredSegments } =
    useContext(UniversalDataContext);
  const {
    radius,
    tubeRes,
    drawAll,
    intensity,
    opacity,
    showCaps,
    cylinderHeight,
  } = useContext(LineSegmentsDataContext);
  const { scene } = useThree();
  const { camera, raycaster, gl } = useThree();
  const meshesRef = useRef([]);
  const [prevMousePos, setPrevMousePos] = useState(new THREE.Vector2(0, 0));

  const handleMouseUp = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button !== 2) return;
      if (coloredSegments && coloredSegments.length > 0) return;

      const rect = gl.domElement.getBoundingClientRect();

      const currMousePos = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      if (currMousePos.distanceTo(prevMousePos) > 0.01) return;

      raycaster.setFromCamera(currMousePos, camera);
      const intersects = raycaster.intersectObjects(meshesRef.current, true);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const intersectionPoint = intersection.point;

        let minDistance = Infinity;
        let closestSegment = null;

        if (segments && segments.length > 0) {
          segments.forEach((segment) => {
            const startPoint = new THREE.Vector3(...segment.startPoint);
            const endPoint = new THREE.Vector3(...segment.endPoint);

            const centerPoint = new THREE.Vector3()
              .addVectors(startPoint, endPoint)
              .multiplyScalar(0.5);

            const distance = centerPoint.distanceTo(intersectionPoint);
            if (distance < minDistance) {
              minDistance = distance;
              closestSegment = segment;
            }
          });
        }

        if (
          selectedSegments.length > 0 &&
          closestSegment.lineIDx === selectedSegments[0].lineIDx
        )
          setSelectedSegments([]);
        else {
          const newSelectedSegments = [];
          segments.forEach((segment) => {
            if (segment.lineIDx === closestSegment.lineIDx) {
              newSelectedSegments.push(segment);
            }
          });
          setSelectedSegments(newSelectedSegments);
        }
      }
    },
    [
      camera,
      raycaster,
      gl.domElement,
      selectedSegments,
      setSelectedSegments,
      segments,
      coloredSegments,
      prevMousePos,
    ]
  );

  const handleMouseDown = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.button !== 2) return;
      const rect = gl.domElement.getBoundingClientRect();
      setPrevMousePos(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        )
      );
    },
    [
      camera,
      raycaster,
      gl.domElement,
      selectedSegments,
      setSelectedSegments,
      segments,
      coloredSegments,
    ]
  );

  useEffect(() => {
    gl.domElement.addEventListener("mousedown", handleMouseDown);
    gl.domElement.addEventListener("contextmenu", handleMouseUp);
    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      gl.domElement.removeEventListener("contextmenu", handleMouseUp);
    };
  }, [gl.domElement, handleMouseUp]);

  useEffect(() => {
    if (!drawAll) return;

    if (selectedSegments.length > 0) {
      render(selectedSegments);
      render(segments, opacity / 10);
    } else if (coloredSegments.length > 0) {
      render(coloredSegments);
    } else if (segments.length > 0) {
      render(segments);
    }

    // Cleanup function to remove the previous instanced mesh
    return () => {
      if (meshesRef.current) {
        meshesRef.current.forEach((mesh) => {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        });
      }
      meshesRef.current = [];
    };
  }, [
    radius,
    tubeRes,
    drawAll,
    segments,
    selectedSegments,
    intensity,
    opacity,
    showCaps,
    cylinderHeight,
    coloredSegments,
    scene,
  ]);

  const render = (data, o = -1) => {
    const material = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: o === -1 ? opacity : o,
    });

    const tubeGeometry = new THREE.CylinderGeometry(
      radius,
      radius,
      cylinderHeight,
      tubeRes,
      1,
      true
    );

    const tubeMesh = new THREE.InstancedMesh(
      tubeGeometry,
      material,
      data.length
    );

    const dummy = new THREE.Object3D();

    data.forEach((segment, i) => {
      const startPoint = new THREE.Vector3(...segment.startPoint);
      const endPoint = new THREE.Vector3(...segment.endPoint);

      const direction = new THREE.Vector3().subVectors(endPoint, startPoint);

      // Axis and angle for the cylinder orientation
      const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
      const angle = Math.acos(
        new THREE.Vector3(0, 1, 0).dot(direction.normalize())
      );

      // Set cylinder mesh position and orientation
      dummy.position.set(...segment.midPoint);
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      dummy.setRotationFromQuaternion(quaternion);

      const distance = new THREE.Vector3()
        .subVectors(startPoint, endPoint)
        .length();
      dummy.scale.set(1, distance, 1);
      dummy.updateMatrix();
      tubeMesh.setMatrixAt(i, dummy.matrix);

      // Update the color of the cylinder
      tubeMesh.setColorAt(i, new THREE.Color(segment.color));
    });

    tubeMesh.instanceMatrix.needsUpdate = true;
    tubeMesh.instanceColor.needsUpdate = true;
    scene.add(tubeMesh);
    meshesRef.current.push(tubeMesh);

    if (showCaps) {
      data.forEach((segment, i) => {
        const startPoint = new THREE.Vector3(...segment.startPoint);
        const endPoint = new THREE.Vector3(...segment.endPoint);

        const direction = new THREE.Vector3().subVectors(endPoint, startPoint);

        // Axis and angle for the cylinder orientation
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const angle = Math.acos(
          new THREE.Vector3(0, 1, 0).dot(direction.normalize())
        );

        // Set cylinder mesh position and orientation
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);

        if (i === 0 || segment.lineIDx !== data[i - 1].lineIDx) {
          const startCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
            }) // Adjust material properties
          );
          startCap.position.copy(startPoint);
          startCap.rotation.setFromQuaternion(quaternion);
          startCap.rotateX(Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(startCap);
          meshesRef.current.push(startCap); // Add to scene or group
        }

        if (i === data.length - 1 || segment.lineIDx !== data[i + 1].lineIDx) {
          const endCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, tubeRes), // Adjust radius and segments as needed
            new THREE.MeshStandardMaterial({
              color: segment.color,
              opacity: o === -1 ? opacity : o,
              transparent: true,
            }) // Adjust material properties
          );
          endCap.position.copy(endPoint);
          endCap.rotation.setFromQuaternion(quaternion);
          endCap.rotateX(-Math.PI / 2); // Rotate to face the cylinder direction
          scene.add(endCap);
          meshesRef.current.push(endCap); // Add to scene or group
        }
      });
    }
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <DirectionalLightWithCamera intensity={intensity} />
      <TrackballControls makeDefault />
    </>
  );
};

export default LineSegmentsRenderer;
