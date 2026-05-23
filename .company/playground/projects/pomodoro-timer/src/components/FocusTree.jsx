/* Focus Tree — pure CSS gummy tree.
   Stages: seedling (0) → sprout (1) → sapling (2) → tree (3) → bloom (4)
*/

export default function FocusTree({ stage = 3, progress = 0.62 }) {
  // foliage cluster radii per stage
  const layouts = [
    /* 0 seedling */ { foliage: [{ x: 50, y: 64, r: 14, c: "lemon" }], trunkH: 6 },
    /* 1 sprout */   { foliage: [
                        { x: 50, y: 58, r: 18, c: "lemon" },
                        { x: 38, y: 64, r: 12, c: "mint" }
                      ], trunkH: 14 },
    /* 2 sapling */  { foliage: [
                        { x: 50, y: 46, r: 24, c: "mint" },
                        { x: 36, y: 56, r: 16, c: "lemon" },
                        { x: 62, y: 56, r: 16, c: "mint2" }
                      ], trunkH: 26 },
    /* 3 tree */     { foliage: [
                        { x: 50, y: 36, r: 30, c: "mint" },
                        { x: 32, y: 48, r: 22, c: "mint2" },
                        { x: 68, y: 48, r: 22, c: "lemon" },
                        { x: 50, y: 56, r: 18, c: "mint" }
                      ], trunkH: 36 },
    /* 4 bloom */    { foliage: [
                        { x: 50, y: 34, r: 32, c: "mint" },
                        { x: 30, y: 46, r: 24, c: "lemon" },
                        { x: 70, y: 46, r: 24, c: "mint2" },
                        { x: 50, y: 56, r: 20, c: "pink" },
                        { x: 40, y: 38, r: 10, c: "pink" },
                        { x: 62, y: 36, r: 10, c: "pink" }
                      ], trunkH: 40 }
  ];

  const layout = layouts[Math.min(stage, layouts.length - 1)];

  const colorFor = (c) => {
    switch (c) {
      case "mint":  return { a: "#dbf6e3", b: "#9bdfb9", c: "#5fbf90" };
      case "mint2": return { a: "#e6f6c8", b: "#bedc7d", c: "#86b045" };
      case "lemon": return { a: "#fff6c5", b: "#ffe585", c: "#e7c046" };
      case "pink":  return { a: "#ffe2ea", b: "#ffb6c8", c: "#ef82a0" };
      default:      return { a: "#dbf6e3", b: "#9bdfb9", c: "#5fbf90" };
    }
  };

  return (
    <div style={ftStyles.wrap}>
      {/* sky/ground backdrop */}
      <div style={ftStyles.sky}/>
      <div style={ftStyles.ground}/>

      {/* ambient particles */}
      <div style={{...ftStyles.particle, top: "18%", left: "18%", background: "#ffe585"}}/>
      <div style={{...ftStyles.particle, top: "30%", right: "16%", background: "#ffd4e0", width: 8, height: 8}}/>
      <div style={{...ftStyles.particle, top: "62%", left: "10%", background: "#cdeff8", width: 6, height: 6}}/>
      <div style={{...ftStyles.particle, top: "48%", right: "8%", background: "#dff5c8"}}/>

      {/* tiny floating leaves */}
      <div style={{...ftStyles.leaf, top: "22%", right: "22%"}}/>
      <div style={{...ftStyles.leaf, top: "70%", left: "20%", transform: "rotate(-30deg)"}}/>

      {/* pot */}
      <div style={ftStyles.pot}>
        <div style={ftStyles.potRim}/>
        <div style={ftStyles.potGloss}/>
      </div>

      {/* trunk */}
      <div style={{
        ...ftStyles.trunk,
        height: `${layout.trunkH}%`,
      }}>
        <div style={ftStyles.trunkGloss}/>
      </div>

      {/* foliage gummy balls */}
      {layout.foliage.map((f, i) => {
        const col = colorFor(f.c);
        return (
          <div key={i} style={{
            position: "absolute",
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: `${f.r * 2}%`,
            height: `${f.r * 2}%`,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${col.a} 0%, ${col.b} 55%, ${col.c} 100%)`,
            boxShadow: `
              inset -6px -8px 16px rgba(0,0,0,0.06),
              inset 4px 6px 12px rgba(255,255,255,0.7),
              0 8px 16px -6px rgba(31,39,72,0.22)
            `
          }}>
            <div style={{
              position: "absolute",
              top: "12%", left: "22%",
              width: "30%", height: "22%",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
              filter: "blur(1px)"
            }}/>
          </div>
        );
      })}
    </div>
  );
}

const ftStyles = {
  wrap: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #f3faff 0%, #fff8ee 70%, #fff3e6 100%)",
    overflow: "hidden",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -2px 0 rgba(31,39,72,0.04)"
  },
  sky: {
    position: "absolute", inset: 0,
    background: "radial-gradient(800px 300px at 50% -20%, #d6ecff 0%, transparent 60%)"
  },
  ground: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    height: "26%",
    background: "linear-gradient(180deg, transparent 0%, rgba(170,210,170,0.22) 40%, rgba(170,210,170,0.35) 100%)"
  },
  particle: {
    position: "absolute",
    width: 10, height: 10,
    borderRadius: "50%",
    boxShadow: "0 4px 8px -4px rgba(31,39,72,0.2), inset 0 2px 0 rgba(255,255,255,0.8)"
  },
  leaf: {
    position: "absolute",
    width: 14, height: 22,
    borderRadius: "70% 30% 70% 30% / 50% 50% 50% 50%",
    background: "radial-gradient(circle at 30% 30%, #e9f8d7, #b8da7d 70%, #8fb74a)",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 8px -4px rgba(31,39,72,0.2)",
    transform: "rotate(20deg)"
  },
  pot: {
    position: "absolute",
    left: "50%",
    bottom: "8%",
    transform: "translateX(-50%)",
    width: "44%",
    height: "20%",
    background: "linear-gradient(180deg, #ffdcc8 0%, #ffb692 55%, #ee8b66 100%)",
    borderRadius: "12% 12% 30% 30% / 18% 18% 50% 50%",
    boxShadow: `
      inset 0 4px 0 rgba(255,255,255,0.6),
      inset 0 -6px 0 rgba(120,40,20,0.18),
      0 14px 22px -10px rgba(31,39,72,0.35)
    `
  },
  potRim: {
    position: "absolute",
    left: "-4%", right: "-4%", top: "-12%",
    height: "32%",
    background: "linear-gradient(180deg, #ffe0cd 0%, #ffb18d 100%)",
    borderRadius: "50%/60%",
    boxShadow: `
      inset 0 3px 0 rgba(255,255,255,0.85),
      inset 0 -3px 0 rgba(180,80,40,0.18),
      0 6px 12px -6px rgba(31,39,72,0.22)
    `
  },
  potGloss: {
    position: "absolute",
    left: "12%", right: "12%", top: "18%",
    height: "30%",
    background: "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))",
    borderRadius: "50%"
  },
  trunk: {
    position: "absolute",
    left: "50%",
    bottom: "24%",
    transform: "translateX(-50%)",
    width: "9%",
    background: "linear-gradient(180deg, #c79268 0%, #a0683f 55%, #7e4a26 100%)",
    borderRadius: "40% 40% 30% 30% / 16% 16% 40% 40%",
    boxShadow: `
      inset 2px 0 0 rgba(255,255,255,0.45),
      inset -2px 0 0 rgba(60,30,10,0.25),
      0 6px 12px -6px rgba(31,39,72,0.30)
    `,
    overflow: "hidden"
  },
  trunkGloss: {
    position: "absolute",
    top: 0, left: "18%",
    width: "30%", height: "100%",
    background: "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0))",
    borderRadius: "999px"
  }
};

