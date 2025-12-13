export default function GridBackground({ children }) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        backgroundColor: "#F8F1E6",
        backgroundImage:
          "radial-gradient(#d3c7b6 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {children}
    </div>
  );
}
