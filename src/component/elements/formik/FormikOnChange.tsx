import { useFormikContext } from 'formik';
import debounce from 'lodash/debounce';
import { useEffect, memo, useRef } from 'react';

interface FormikOnChangeProps {
  onChange?: (value: any) => void;
  enableValidation?: boolean;
  enableOnload?: boolean;
  debounceTime?: number;
}

const FormikOnChange = (props: FormikOnChangeProps) => {
  const {
    onChange = () => null,
    enableValidation = true,
    enableOnload = false,
    debounceTime = 0,
  } = props;
  const { values, errors, setTouched, initialValues } = useFormikContext();
  const previousValuesRef = useRef<any>(enableOnload ? {} : initialValues);

  const debounceOnChange = useRef(
    debounce((value) => {
      onChange(value);
    }, debounceTime),
  );

  useEffect(() => {
    const isChanged =
      JSON.stringify(previousValuesRef.current) !== JSON.stringify(values);
    if (isChanged) {
      if (enableValidation) {
        if (Object.keys(errors).length === 0 && isChanged) {
          debounceOnChange.current(values);
        } else {
          void setTouched(errors);
        }
      } else {
        debounceOnChange.current(values);
      }
    }

    previousValuesRef.current = values;
  }, [values, enableValidation, errors, onChange, setTouched, initialValues]);

  return null;
};

export default memo(FormikOnChange);
