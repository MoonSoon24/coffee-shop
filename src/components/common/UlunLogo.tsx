import logoSvg from '../../assets/ulunLogo.svg';

interface UlunLogoProps {
  className?: string;
  invertOnDark?: boolean;
}

export const UlunLogo = ({ className = 'h-8', invertOnDark = true }: UlunLogoProps) => (
  <img
    src={logoSvg}
    alt="Ulun Coffee"
    className={`${className} ulun-logo object-contain ${invertOnDark ? 'ulun-logo--adaptive' : ''}`}
  />
);