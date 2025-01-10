import React, { useState } from "react";

// Define more complex shapes as SVG paths
const shapes = {
  circle: <circle cx="50" cy="50" r="40" />,
  square: <rect x="10" y="10" width="80" height="80" />,
  triangle: <polygon points="50,10 90,90 10,90" />,
  cross: <path d="M20,20 L80,80 M20,80 L80,20" />,
  star: (
    <path d="M50,10 L61,40 L94,40 L69,60 L79,90 L50,73 L21,90 L31,60 L6,40 L39,40 Z" />
  ),
  hexagon: <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" />,
  diamond: <polygon points="50,10 90,50 50,90 10,50" />,
};

// Function to generate a random valid string
const generateRandomString = (length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

// Function to generate an icon based on input string
const generateIcon = (input: string): JSX.Element[] => {
  const grid = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [0, 0.5],
    [0.5, 0.5],
    [1, 0.5],
    [0, 1],
    [0.5, 1],
    [1, 1],
  ];

  const layers = [0.8, 1, 1.2]; // Scale factors for layers

  return input
    .split("")
    .slice(0, 9)
    .flatMap((char, index) => {
      const [x, y] = grid[index];
      const shapeIndex = char.charCodeAt(0) % Object.keys(shapes).length;
      const shape = Object.values(shapes)[shapeIndex];
      const rotation = (char.charCodeAt(0) * 10) % 360;
      const color = `hsl(0, 0%, ${(char.charCodeAt(0) * 5) % 20}%)`; // Varying shades of black

      return layers.map((scale, layerIndex) => (
        <g
          key={`${index}-${layerIndex}`}
          transform={`translate(${x * 300}, ${
            y * 300
          }) scale(${scale}) rotate(${rotation}, 50, 50)`}
        >
          {React.cloneElement(shape, {
            fill: color,
            stroke: "black",
            strokeWidth: 2,
          })}
        </g>
      ));
    });
};

export const IconSelector: React.FC = () => {
  const [inputString, setInputString] = useState("");

  const handleGenerateRandom = () => {
    setInputString(generateRandomString(9));
  };

  return (
    <div className="icon-selector">
      <input
        type="text"
        value={inputString}
        onChange={(e) => setInputString(e.target.value)}
        placeholder="Enter a string or generate random"
      />
      <button onClick={handleGenerateRandom}>Generate Random</button>
      <svg
        width="300"
        height="300"
        viewBox="0 0 300 300"
        style={{ backgroundColor: "#f0f0f0" }}
      >
        {generateIcon(inputString)}
      </svg>
    </div>
  );
};
