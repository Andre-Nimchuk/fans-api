import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { ThreadMessage } from '../model/thread-messages';
import { createHistoryScrollGate } from '../utils/history-scroll-gate';

export function useMessageScroll(jumpRequest: number, loadOlder: () => Promise<void>) {
  const list = useRef<FlatList<ThreadMessage>>(null);
  const pagination = useRef(createHistoryScrollGate());
  const atBottom = useRef(true);
  const lastJump = useRef(jumpRequest);
  const [showLatest, setShowLatest] = useState(false);

  const scrollToLatest = useCallback(() => {
    pagination.current.endScroll();
    atBottom.current = true;
    setShowLatest(false);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  useEffect(() => {
    if (lastJump.current !== jumpRequest) {
      lastJump.current = jumpRequest;
      scrollToLatest();
    }
  }, [jumpRequest, scrollToLatest]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const nearBottom = contentOffset.y < 64;

      atBottom.current = nearBottom;
      setShowLatest(!nearBottom);
      if (
        pagination.current.shouldLoad(
          contentOffset.y,
          contentSize.height - layoutMeasurement.height - contentOffset.y,
        )
      ) {
        void loadOlder();
      }
    },
    [loadOlder],
  );

  function onScrollBeginDrag(event: NativeSyntheticEvent<NativeScrollEvent>) {
    pagination.current.beginDrag(event.nativeEvent.contentOffset.y);
  }

  // Layout/content callbacks also cover keyboard and composer resizing without scrolling a reader away.
  function keepPosition() {
    if (lastJump.current !== jumpRequest) {
      lastJump.current = jumpRequest;
      scrollToLatest();
    } else if (atBottom.current) {
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }

  return {
    list,
    showLatest,
    scrollToLatest,
    onScroll,
    keepPosition,
    onScrollBeginDrag,
    onScrollEndDrag: () => pagination.current.endScroll(),
    onMomentumScrollBegin: () => pagination.current.beginMomentum(),
    onMomentumScrollEnd: () => pagination.current.endScroll(),
  };
}
