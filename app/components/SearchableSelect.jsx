import { useState, useEffect, useRef } from "react";

/**
 * Searchable dropdown replacement for s-select.
 * Uses position:fixed for the dropdown panel so it overlaps all parent containers.
 * Props:
 *   label      — label text above the field
 *   value      — currently selected value (string)
 *   onChange   — callback(value: string)
 *   options    — [{ value: string, label: string }]
 *   placeholder
 *   disabled
 *   loading    — shows "Loading..." and disables interaction
 */
export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  loading = false,
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 200 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function updatePanelPos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", updatePanelPos, true);
    window.addEventListener("resize", updatePanelPos);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", updatePanelPos, true);
      window.removeEventListener("resize", updatePanelPos);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const isDisabled = disabled || loading;

  function handleTriggerClick() {
    if (!isDisabled) {
      if (!isOpen) updatePanelPos();
      setIsOpen((prev) => !prev);
    }
  }

  function handleSelect(val) {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {label && (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#4a5568",
            marginBottom: "5px",
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </div>
      )}

      {/* Trigger button */}
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        style={{
          border: `1.5px solid ${isOpen ? "#3563d4" : isDisabled ? "#e1e3e5" : "#c9d4ea"}`,
          borderRadius: "8px",
          padding: "9px 12px",
          cursor: isDisabled ? "not-allowed" : "pointer",
          background: isDisabled ? "#f6f6f7" : isOpen ? "#f7f9ff" : "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          userSelect: "none",
          minHeight: "38px",
          transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
          boxSizing: "border-box",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(53,99,212,0.12)"
            : "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
        <span
          style={{
            color: selectedOption ? "#1a202c" : "#9ca3af",
            fontSize: "13px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            fontWeight: selectedOption ? "500" : "normal",
          }}
        >
          {loading ? "Loading..." : selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          style={{
            fontSize: "9px",
            marginLeft: "8px",
            color: isOpen ? "#3563d4" : "#a0aec0",
            flexShrink: 0,
            display: "inline-block",
            transition: "transform 0.2s, color 0.15s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </div>

      {/* Floating dropdown — position:fixed so it overlaps all parent containers */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: `${panelPos.top}px`,
            left: `${panelPos.left}px`,
            width: `${panelPos.width}px`,
            background: "#fff",
            border: "1.5px solid #c9d4ea",
            borderRadius: "10px",
            boxShadow:
              "0 16px 48px rgba(53,99,212,0.16), 0 4px 16px rgba(0,0,0,0.08)",
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search bar */}
          <div
            style={{
              padding: "8px",
              borderBottom: "1px solid #e8edf8",
              background: "linear-gradient(180deg, #f7f9ff 0%, #f0f4fe 100%)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                border: "1px solid #d0d9ee",
                borderRadius: "6px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                color: "#1a202c",
                background: "#fff",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "9px center",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: "240px", overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  color: "#a0aec0",
                  textAlign: "center",
                  fontSize: "13px",
                }}
              >
                No results found
              </div>
            ) : (
              filtered.map((opt) => {
                const isSel = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    style={{
                      padding: "9px 14px",
                      cursor: "pointer",
                      background: isSel ? "#eef2ff" : "transparent",
                      color: isSel ? "#3563d4" : "#1a202c",
                      fontSize: "13px",
                      fontWeight: isSel ? "600" : "normal",
                      borderLeft: isSel
                        ? "3px solid #3563d4"
                        : "3px solid transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) e.currentTarget.style.background = "#f7f9ff";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
