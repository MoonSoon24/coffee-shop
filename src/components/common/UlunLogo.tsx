import logoPng from '../../assets/ulunLogo.png'; 

export const UlunLogo = ({ className = "h-8" }: { className?: string }) => (
  <img 
    src={logoPng} 
    alt="Ulun Coffee" 
    className={`${className} object-contain brightness-0 invert`} 
  />
);