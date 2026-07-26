import { motion } from 'framer-motion';

interface Props {
  options: string[];
  image: string | null;
  disabled: boolean;
  onPick: (index: number) => void;
}

/** Four-way multiple choice. Options arrive pre-shuffled from the host. */
export function VisualPuzzleGame({ options, image, disabled, onPick }: Props): JSX.Element {
  return (
    <div className="flex w-full flex-col gap-4">
      {image && (
        <img
          src={image}
          alt=""
          className="mx-auto max-h-44 rounded-chunk object-contain"
          draggable={false}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {options.map((label, index) => (
          <motion.button
            key={`${label}_${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(index)}
            whileTap={{ scale: 0.94 }}
            className="btn-secondary min-h-[72px] text-xl"
          >
            {label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
