import { useResize } from '../../hooks/useResize';

interface ResizeHandleProps {
  onResize: (dw: number, dh: number) => void;
  onResizeEnd: () => void;
}

export function ResizeHandle({ onResize, onResizeEnd }: ResizeHandleProps) {
  const handlers = useResize({ onResize, onResizeEnd });

  return (
    <>
      <div className="resize-handle resize-handle-e" {...handlers} />
      <div className="resize-handle resize-handle-s" {...handlers} />
      <div className="resize-handle resize-handle-se" {...handlers} />
    </>
  );
}
