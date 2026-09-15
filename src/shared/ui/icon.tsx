import Svg, { Path } from 'react-native-svg';

const paths = {
  back: 'M19 12H5m7-7-7 7 7 7',
  send: 'm21 3-7 18-4-7-7-4 18-7ZM21 3 10 14',
  down: 'M12 4v16m-6-6 6 6 6-6',
  chevron: 'm9 5 7 7-7 7',
} as const;

export function Icon({
  name,
  color = '#202127',
  size = 22,
}: {
  name: keyof typeof paths;
  color?: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
