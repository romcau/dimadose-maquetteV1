export default function Group() {
  return (
    <div className="contents relative size-full">
      <p className="[word-break:break-word] absolute font-['Inter:Extra_Bold',sans-serif] font-extrabold h-[269px] leading-[0] left-0 not-italic text-[#05192f] text-[250px] top-0 w-[1737px]">
        <span className="font-['Science_Gothic:Bold',sans-serif] font-bold leading-[normal]" style={{ fontVariationSettings: '"CTRS" 0, "wdth" 100' }}>
          DIMA
        </span>
        <span className="bg-clip-text bg-gradient-to-r font-['Science_Gothic:Bold',sans-serif] font-bold from-[#3d4fe2] from-[32.692%] leading-[normal] text-[transparent] to-[#048bc5]" style={{ fontVariationSettings: '"CTRS" 0, "wdth" 100' }}>
          DOSE
        </span>
      </p>
      <div className="absolute flex h-[14px] items-center justify-center left-0 top-0 w-[106px]">
        <div className="-rotate-90 flex-none">
          <div className="bg-[rgba(5,25,47,0.2)] h-[106px] relative rounded-[7px] w-[14px]" />
        </div>
      </div>
      <div className="absolute bg-[rgba(5,25,47,0.2)] h-[92px] left-0 rounded-[7.135px] top-0 w-[14.27px]" />
      <div className="absolute bg-[rgba(5,25,47,0.2)] h-[94.24px] left-0 rounded-[7.137px] top-0 w-[14.274px]" />
      <div className="absolute flex h-[14px] items-center justify-center left-0 top-0 w-[111px]">
        <div className="-rotate-90 flex-none">
          <div className="bg-[rgba(5,25,47,0.2)] h-[111px] relative rounded-[7px] w-[14px]" />
        </div>
      </div>
      <div className="absolute left-0 size-[60px] top-0">
        <div className="absolute inset-[-6.67%]">
          <svg className="block size-full" fill="none" height="68" preserveAspectRatio="none" viewBox="0 0 68 68" width="68">
            <g filter="url(#filter0_f_0_4)" id="Ellipse 39">
              <circle cx="34" cy="34" fill="url(#paint0_radial_0_4)" r="30" />
            </g>
            <defs>
              <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="68" id="filter0_f_0_4" width="68" x="0" y="0">
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
                <feGaussianBlur result="effect1_foregroundBlur_0_4" stdDeviation="2" />
              </filter>
              <radialGradient cx="0" cy="0" gradientTransform="translate(34 34) rotate(90) scale(30)" gradientUnits="userSpaceOnUse" id="paint0_radial_0_4" r="1">
                <stop stopColor="#FDFCFD" />
                <stop offset="1" stopColor="#2B61D9" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}