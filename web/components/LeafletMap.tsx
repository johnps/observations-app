import dynamic from 'next/dynamic';

const MapContent = dynamic(
  () => import('./MapContent').then(m => m.MapContent),
  { ssr: false }
);

type Props = {
  center: [number, number];
  zoom: number;
};

export function LeafletMap(props: Props) {
  return <MapContent {...props} />;
}
