import { $, component$, PropFunction, QwikMouseEvent, Signal, Slot, useClientEffect$, useContextProvider, useSignal, useStore, useTask$, } from '@builder.io/qwik';import { isBrowser } from '@builder.io/qwik/build';
import { AlignedPlacement, autoUpdate, computePosition, flip, offset, shift, Side, } from '@floating-ui/dom';
import { PopoverContext } from './popover-context';

interface PopoverProps {
  /*
   * The side where to show the popover
   */
  placement?: Side | AlignedPlacement;
  /**
   * Popover is opened when trigger is clicked or mouse overed
   */
  triggerEvent?: 'click' | 'mouseOver';
  /**
   * offset between trigger and content
   */
  offset?: number;
  /**
   * Open or close the popover when popover is controlled by the parent
   */
  isOpen?: boolean;

  onUpdate$?: PropFunction<(isOpen: boolean) => void>
}

export const Popover = component$((props: PopoverProps) => {
  const { triggerEvent = 'click', onUpdate$ } = props;
  const wrapperRef = useSignal<HTMLElement>();
  const triggerRef = useSignal<HTMLElement>();
  const contentRef = useSignal<HTMLElement>();

  const setOverlayRef$ = $((ref: Signal<HTMLElement | undefined>) => {
    if (ref) {
      contentRef.value = ref.value;
    }
  });

  const setTriggerRef$ = $((ref: Signal<HTMLElement | undefined>) => {
    if (ref) {
      triggerRef.value = ref.value;
    }
  });

  const contextService = useStore({
    isOpen: false,
    triggerEvent,
    setTriggerRef$,
    setOverlayRef$
  });
  useContextProvider(PopoverContext, contextService);

  /**
   * Close the popover and sync external states
   */
  const closePopover = $(async () => {
    contextService.isOpen = false
    if (onUpdate$)
      await onUpdate$(contextService.isOpen)
  })

  /**
   * Open the popover and sync external states
   */
  const openPopover = $(async () => {
    contextService.isOpen = true
    if (onUpdate$)
      await onUpdate$(contextService.isOpen)
  })

  /**
   * Toggle the popover state and emit update
   */
  const togglePopover = $(async () => {
    if (contextService.isOpen) {
      closePopover()
    } else {
      openPopover();
    }

    if (onUpdate$)
      await onUpdate$(contextService.isOpen)
  })

  /**
   * Initialize popover
   * NOTE: why useTask instead useClientEffect?
   * It needs to be invoked after the children useClientEffect
   */
  useTask$(({ track }) => {
    const trigger = track(() => triggerRef.value as Element) ;
    const content = track(() => contentRef.value as HTMLElement);

    if (isBrowser && trigger && content) {
       autoUpdate(trigger, content, () => {
        computePosition(trigger, content, {
          middleware: [flip(), shift(), offset(props.offset || 0)],
          placement: props.placement,
        })
          .then(({x, y}) => {
            Object.assign(content.style, {
              left: `${x}px`,
              top: `${y}px`,
            });
          });
      })

      // Open popover after initialization
      if (props.isOpen) {
        openPopover()
      }
    }

  });

  /**
   * Sync isOpen external property with internal context
   * NOTE: useful when the popover status is controlled from the outside
   */
  useClientEffect$(({ track }) => {
    track(() => props.isOpen);
    if (!props.isOpen)
      contextService.isOpen = !!props.isOpen;
  })

  /**
   * Watch isOpen context property
   * and apply CSS classes to show and hide the Popover Content
   */
  useClientEffect$(({ track }) => {
    track(() => contextService.isOpen);
    if (!triggerRef.value || !contentRef.value) return;

    if (contextService.isOpen) {
      contentRef?.value.classList?.add('open');
      contentRef?.value.classList?.remove('close');
    } else {
      contentRef?.value.classList?.add('close');
      contentRef?.value.classList?.remove('open');
    }
  })

  /**
   * clickOutsideHandler
   */
  const clickOutsideHandler = $((e: QwikMouseEvent) => {
    // if the popover content is clicked: do nothing
    const isContentClicked = contentRef.value?.contains(e.target as HTMLElement);
    if (isContentClicked) {
      return;
    }

    // if click outside the popover
    const isTriggerClicked = triggerRef.value?.contains(e.target as HTMLElement);
    if (isTriggerClicked && triggerEvent === 'click') {
      // toggle if triggered by 'click'
      togglePopover();
    } else {
      // otherwise close it if popover is triggered
      closePopover();
    }
  })

  return (
    <div
      ref={wrapperRef}
      document:onClick$={clickOutsideHandler}
    >
      <Slot />
    </div>
  )
});
