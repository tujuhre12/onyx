import { useState } from "react";
import type { NextPage } from "next";
import Head from "next/head";

/**
 * Utility function to generate a random string.
 */
function generateRandomString(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Simple pseudo-hash: convert characters into numeric values
 * and store them in an array that we will iterate over.
 */
function pseudoHash(str: string): number[] {
  const values: number[] = [];
  for (let i = 0; i < str.length; i++) {
    values.push(str.charCodeAt(i));
  }
  return values;
}

/**
 * Identicon Component
 *
 * Props:
 *   - idString: the string to generate an identicon for
 *   - gridSize: how many rows and columns to use (default 7)
 *
 * Logic:
 *   - If string too short, show fallback
 *   - Use a symmetrical approach:
 *       * We only define columns 0..(halfColumns-1) for each row
 *       * Mirror them to the "other side."
 *   - Each cell is 8x8, we make squares slightly bigger for overlap
 */
interface IdenticonProps {
  idString: string;
  gridSize?: number;
}

function Identicon({ idString, gridSize = 7 }: IdenticonProps) {
  // Fallback if string too short
  if (idString.length <= 2) {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56">
        <rect x={8} y={8} width={40} height={40} fill="black" />
      </svg>
    );
  }

  // Each cell is 8x8
  const cellSize = 8;
  const totalSize = gridSize * cellSize; // e.g., 7 * 8 = 56
  const hashValues = pseudoHash(idString);

  // For both even and odd gridSizes, let's define "halfColumns" as
  // the ceiling of gridSize/2. So for 7, halfColumns=4; for 8, halfColumns=4.
  // This means if gridSize is odd, the center column is shared in the mirror.
  const halfColumns = Math.ceil(gridSize / 2);

  const cells: JSX.Element[] = [];
  let hashIndex = 0;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < halfColumns; col++) {
      const hashVal = hashValues[hashIndex % hashValues.length];
      hashIndex++;

      // If even => fill cell
      if (hashVal % 2 === 0) {
        const xPos = col * cellSize;
        const yPos = row * cellSize;

        // Draw a square slightly larger for overlap
        cells.push(
          <rect
            x={xPos - 1}
            y={yPos - 1}
            width={cellSize + 2}
            height={cellSize + 2}
            fill="black"
          />
        );

        // Mirror to the other side if col < halfColumns-1
        //   If gridSize = 7 => halfColumns=4 => columns=0..3
        //     => The last column (col=3) is the center; we still draw it only once
        //   If gridSize = 8 => halfColumns=4 => columns=0..3
        //     => No center column, so we mirror col=3 to col=4
        // Generally: for col < gridSize - col - 1
        // A simpler way is to compute the mirrorCol = gridSize-1-col and
        // only draw it if mirrorCol != col (i.e., if col isn’t exactly in the middle).
        const mirrorCol = gridSize - 1 - col;
        if (mirrorCol !== col) {
          const mirrorXPos = mirrorCol * cellSize;
          cells.push(
            <rect
              key={`cell-${row}-${mirrorCol}`}
              x={mirrorXPos - 1}
              y={yPos - 1}
              width={cellSize + 2}
              height={cellSize + 2}
              fill="black"
            />
          );
        }
      }
    }
  }

  return (
    <svg
      width={totalSize}
      height={totalSize}
      viewBox={`0 0 ${totalSize} ${totalSize}`}
    >
      {cells}
    </svg>
  );
}

const IdenticonPage: NextPage = () => {
  const [currentString, setCurrentString] = useState("hello123");
  const [currentGridSize, setCurrentGridSize] = useState(7);

  const handleClick = () => {
    setCurrentString(generateRandomString());
  };

  return (
    <>
      <Head>
        <title>Identicon Generator with Variable Grid</title>
      </Head>

      <main style={{ padding: "2rem" }}>
        <h1>Identicon Generator with Variable Grid</h1>
        <p>
          Adjust the grid size, then generate a random string to see how the
          identicon changes.
        </p>

        <label htmlFor="gridSizeSelector" style={{ marginRight: "0.5rem" }}>
          Grid Size:
        </label>
        <input
          type="number"
          id="gridSizeSelector"
          value={currentGridSize}
          onChange={(e) => {
            // Keep the grid size in a sensible range
            const num = parseInt(e.target.value, 10);
            if (num > 0 && num < 20) {
              setCurrentGridSize(num);
            }
          }}
          style={{ marginRight: "1rem", width: "60px" }}
        />

        <button
          onClick={handleClick}
          style={{ marginBottom: "1rem", padding: "0.5rem 1rem" }}
        >
          Generate Random String
        </button>

        <div>
          <p>
            Current String: <strong>{currentString}</strong>
            <br />
            Current Grid Size: <strong>{currentGridSize}</strong>
          </p>
          <Identicon idString={currentString} gridSize={currentGridSize} />
        </div>
      </main>
    </>
  );
};

export default IdenticonPage;
