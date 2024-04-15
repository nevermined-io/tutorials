import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './modal.scss';

type PortalProps = React.PropsWithChildren<{ selector?: string }>;

const Portal: React.FC<PortalProps> = ({
  selector = '__MODAL__',
  children,
}) => {
  const ref = useRef<RefType>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    const selectorPrefixed = `#${selector.replace(/^#/, '')}`;
    ref.current = document.querySelector(selectorPrefixed);

    if (!ref.current) {
      const div = document.createElement('div');
      div.setAttribute('id', selector);
      document.body.append(div);
      ref.current = div;
    }

    setMounted(true);
  }, [selector]);

  if (!ref.current) {
    return null;
  }

  return mounted ? createPortal(children, ref.current) : null;
};

type ModalProps = React.PropsWithChildren<{
  onCloseClick?: () => void;
  position?: 'center' | 'top right';
}>;
type RefElement = HTMLElement;
type RefType = RefElement | null;

export const Modal: React.FC<ModalProps> = ({ onCloseClick, children }) => {
  const ref = useRef<RefType>(null);
  const overlayRef = useRef<RefType>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [dimensions, setDimensions] = useState<{
    width: string | undefined;
    height: string | undefined;
  }>({
    width: undefined,
    height: undefined,
  });

  const cssDimensions = {
    '--height': dimensions.height,
    '--width': dimensions.width,
  } as React.CSSProperties;

  const contentRef = useCallback((node: RefElement) => {
    if (!node) {
      return;
    }

    ref.current = node;
    updateBounds(node);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (ref.current && isOpen) {
      updateBounds(ref.current);
    }
  }, [isOpen, children]);

  const handleOverlayClick = useCallback(() => {
    if (overlayRef.current?.contains(ref.current)) {
      return;
    }

    onCloseClick?.();
  }, []);

  const updateBounds = (node: RefElement) => {
    const bounds = {
      width: node?.offsetWidth,
      height: node?.offsetHeight,
    };
    setDimensions({
      width: `${bounds?.width}px`,
      height: `${bounds?.height}px`,
    });
  };

  return (
    <Portal>
      <div className="modal" role="dialog">
        <div
          ref={overlayRef as React.MutableRefObject<HTMLDivElement>}
          className="modal-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
        <div
          className="modal-container"
          style={cssDimensions}
          aria-modal="true"
        >
          <div
            style={{
              pointerEvents: 'none', // Block interaction while transitioning
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'var(--width)',
              zIndex: 9,
              transition: 'width 200ms ease',
            }}
          />
          <div
            className={`modal-box-container ${isOpen && 'modal-box-container--active'}`}
          >
            <div className="modal-inner-container">
              <div
                className="modal-external-content"
                ref={contentRef as (node: HTMLDivElement) => void}
              >
                <div className="modal-content-wrapper">
                  <div className="modal-content-header">
                    <div className="modal-close-button-wrapper">
                      <button
                        className="modal-close-button"
                        onClick={() => onCloseClick?.()}
                      >
                        X
                      </button>
                    </div>
                  </div>
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
