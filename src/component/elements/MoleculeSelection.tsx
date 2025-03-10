/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';
import { useCallback, useEffect, useState } from 'react';
import MF from 'react-mf/lib/components/MF';
import { MolfileSvgRenderer } from 'react-ocl/full';

import { StateMoleculeExtended } from '../../data/molecules/Molecule';

import NextPrev from './NextPrev';

const toolbarStyle = css`
  display: flex;
  flex-direction: row;
  border-top: 0.55px solid rgb(240 240 240);
  border-bottom: 0.55px solid rgb(240 240 240);
  padding: 0 5px;

  p {
    margin: 0;
    text-align: right;
    width: 100%;
    line-height: 22px;
    padding: 0 10px;
  }
`;

const moleculeContainerStyle = css`
  width: 100%;
  position: relative;

  .slider {
    height: 180px;
    width: 100%;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
  }

  .slider p {
    width: 100%;
    margin: 0 auto;
    display: block;
    position: relative;
    text-align: center;
  }

  .slider svg polygon {
    fill: gray !important;
  }

  button {
    flex: 2;
    padding: 5px;
    border: 1px solid gray;
    border-radius: 5px;
    height: 36px;
    margin: 0 auto;
    margin-top: 15px;
    display: block;
    width: 20%;
    color: white;
    background-color: gray;
  }
`;

interface MoleculeSelectionProps {
  molecules: StateMoleculeExtended[];
  onChange: (element: number) => void;
  index?: number;
}

export default function MoleculeSelection(props: MoleculeSelectionProps) {
  const { molecules, onChange = () => null, index } = props;
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    const _index = index && index < molecules.length ? index : 0;
    if (molecules && molecules.length > 0) {
      setCurrentIndex(_index);
    }
  }, [index, molecules]);

  const onChangeHandler = useCallback(
    (slideIndex) => {
      setCurrentIndex(slideIndex);
      onChange(slideIndex);
    },
    [onChange],
  );

  return (
    <div>
      <div css={toolbarStyle}>
        <p>
          {molecules &&
            molecules.length > 0 &&
            `${+(currentIndex + 1)} / ${molecules.length}`}{' '}
        </p>
      </div>
      <div css={moleculeContainerStyle}>
        <NextPrev defaultIndex={currentIndex} onChange={onChangeHandler}>
          {molecules?.map((mol, index) => (
            <div key={mol.id} className="slider">
              <div>
                {mol.molfile && (
                  <MolfileSvgRenderer
                    id={`molSVG${index}`}
                    width={120}
                    molfile={mol.molfile}
                  />
                )}
              </div>
              <p>
                <MF mf={mol.mf} /> - {mol.mw?.toFixed(2)}
              </p>
            </div>
          ))}
        </NextPrev>
      </div>
    </div>
  );
}
