// originally from https://gist.githubusercontent.com/serifcolakel/5371623d19eee2e4630ff3e11ef3c64e/raw/0f578a77d77fdb8c59da325701a8f7d620739760/useEventListener.ts

import { RefObject, useEffect, useRef } from 'preact/compat';

function useEventListener<K extends keyof MediaQueryListEventMap>(
    eventName: K,
    handler: (event: MediaQueryListEventMap[K]) => void,
    element: RefObject<MediaQueryList>,
    options?: boolean | AddEventListenerOptions,
): void;

function useEventListener<K extends keyof WindowEventMap>(
    eventName: K,
    handler: (event: WindowEventMap[K]) => void,
    element?: undefined,
    options?: boolean | AddEventListenerOptions,
): void;

function useEventListener<
    K extends keyof HTMLElementEventMap,
    T extends HTMLElement = HTMLDivElement,
>(
    eventName: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    element: RefObject<T>,
    options?: boolean | AddEventListenerOptions,
): void;

function useEventListener<K extends keyof DocumentEventMap>(
    eventName: K,
    handler: (event: DocumentEventMap[K]) => void,
    element: RefObject<Document>,
    options?: boolean | AddEventListenerOptions,
): void;

function useEventListener<
    KW extends keyof WindowEventMap,
    KH extends keyof HTMLElementEventMap,
    KM extends keyof MediaQueryListEventMap,
    T extends HTMLElement | MediaQueryList | void = void,
>(
    eventName: KW | KH | KM,
    handler: (
        event:
            | WindowEventMap[KW]
            | HTMLElementEventMap[KH]
            | MediaQueryListEventMap[KM]
            | Event,
    ) => void,
    element?: RefObject<T>,
    options?: boolean | AddEventListenerOptions,
) {
    const savedHandler = useRef(handler);

    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        const targetElement: T | Window = element?.current ?? window;

        if (!(targetElement?.addEventListener)) return;

        const listener: typeof handler = (event) => savedHandler.current(event);

        targetElement.addEventListener(eventName, listener, options);

        return () => {
            targetElement.removeEventListener(eventName, listener, options);
        };
    }, [eventName, element, options]);
}

export default useEventListener;