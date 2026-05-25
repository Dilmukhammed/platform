"use client";

import { useState, useEffect, useRef } from "react";
import type { AnnotationRecord } from "@/modules/annotations";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; width: number };

interface AnnotationOverlayProps {
  reviewId: string;
  submissionId: string;
  assetId: string;
  pageNumber: number | null;
  width: number;
  height: number;
  readOnly?: boolean;
  initialAnnotations?: AnnotationRecord[];
}

export function AnnotationOverlay({
  reviewId,
  submissionId,
  assetId,
  pageNumber,
  width,
  height,
  readOnly = false,
  initialAnnotations = [],
}: AnnotationOverlayProps) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const annotation = initialAnnotations.find(a => a.assetId === assetId && a.pageNumber === pageNumber);
    if (annotation && annotation.data && Array.isArray(annotation.data.strokes)) {
      setStrokes(annotation.data.strokes);
    } else {
      setStrokes([]);
    }
  }, [assetId, pageNumber, initialAnnotations]);

  const saveAnnotations = async (newStrokes: Stroke[]) => {
    setSaveError(null);
    const response = await fetch(`/api/v1/teacher/assignment-results/${submissionId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        derivedAssetId: assetId,
        pageIndex: pageNumber ?? undefined,
        baseWidth: width,
        baseHeight: height,
        payloadJson: {
          strokes: newStrokes,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || "Failed to save annotation.");
    }
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: ((clientX - rect.left) / rect.width) * width,
      y: ((clientY - rect.top) / rect.height) * height,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const point = getCoordinates(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentStroke({ points: [point], color: "red", width: 2 });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke || readOnly) return;
    e.preventDefault();
    const point = getCoordinates(e);
    if (!point) return;

    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point],
    });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentStroke || readOnly) return;
    setIsDrawing(false);
    
     if (currentStroke.points.length > 1) {
       const newStrokes = [...strokes, currentStroke];
       setStrokes(newStrokes);
       void saveAnnotations(newStrokes).catch((err) => {
         setSaveError(err instanceof Error ? err.message : "Failed to save annotation.");
       });
     }
    setCurrentStroke(null);
  };

  const handleClear = () => {
    if (readOnly) return;
    setStrokes([]);
    void saveAnnotations([]).catch((err) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save annotation.");
    });
  };

  const renderStroke = (stroke: Stroke, index: number) => {
    const d = stroke.points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    return (
      <path
        key={index}
        d={d}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  return (
    <div className="relative" style={{ width: "100%", height: "100%", aspectRatio: `${width}/${height}` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full z-10 touch-none"
        style={{ cursor: readOnly ? "default" : "crosshair" }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        {strokes.map((stroke, i) => renderStroke(stroke, i))}
        {currentStroke && renderStroke(currentStroke, strokes.length)}
      </svg>
      {!readOnly && (
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 z-20 bg-white/80 px-2 py-1 text-xs rounded shadow hover:bg-white"
        >
          Clear
        </button>
      )}
      {!readOnly && saveError && (
        <div className="absolute bottom-2 left-2 z-20 max-w-[70%] rounded border border-error bg-error-subtle/90 px-2 py-1 text-xs text-error shadow">
          {saveError}
        </div>
      )}
    </div>
  );
}
