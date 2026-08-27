import Image from "next/image";

export default function BrandLockup() {
  return (
    <div className="brand brand-lockup">
      <Image src="/realsign-logo.png" width={48} height={48} alt="" priority />
      <span className="brand-copy">
        <strong>REALSIGN</strong>
        <small>by RealSASL</small>
      </span>
    </div>
  );
}
