"use client";

export function VRBadge() {
  // badge fixed in a corner with logo and text
  // if the file is missing the <img> will be hidden so the text remains visible
  return (
    <div className="vr-badge">
      {/* place your logo at public/vr-abandonada.png */}
      <img
        src="/vr-abandonada.png"
        alt="VR Abandonada"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <span>faz parte do projeto VR Abandonada</span>
    </div>
  );
}
