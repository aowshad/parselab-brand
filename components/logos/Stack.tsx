/**
 * Renders every option in the same grid cell and shows only the active one, so
 * the block is always as tall as its tallest option and switching never shifts layout.
 */
export function Stack<T>({
  items,
  isActive,
  render,
  getKey,
  className = "",
}: {
  items: T[];
  isActive: (item: T) => boolean;
  render: (item: T) => React.ReactNode;
  getKey: (item: T) => string;
  className?: string;
}) {
  return (
    <div className={`grid ${className}`}>
      {items.map((item) => (
        <div key={getKey(item)} className={`[grid-area:1/1] ${isActive(item) ? "" : "invisible"}`} aria-hidden={!isActive(item)}>
          {render(item)}
        </div>
      ))}
    </div>
  );
}
