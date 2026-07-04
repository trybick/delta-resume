type DeltaLogoProps = {
  size?: number
}

const DeltaLogo = ({ size = 40 }: DeltaLogoProps) => (
  <img
    src="/favicon.svg"
    width={size}
    height={size}
    alt="Delta Resume logo"
  />
)

export default DeltaLogo
