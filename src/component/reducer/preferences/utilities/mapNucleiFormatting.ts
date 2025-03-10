import { Formatting } from 'nmr-load-save';

export function mapNucleiFormatting(formatting: Formatting): Formatting {
  const { nuclei, ...res } = formatting;

  return {
    nuclei: Object.fromEntries(
      Object.keys(nuclei).map((key) => [
        nuclei[key].name.trim().toLowerCase(),
        nuclei[key],
      ]),
    ),
    ...res,
  };
}
