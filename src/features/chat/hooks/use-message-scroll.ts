import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { ThreadMessage } from '../model/thread-messages';

export function useMessageScroll(jumpRequest: number) {
  const list = useRef<FlatList<ThreadMessage>>(null);
  const atBottom = useRef(true);
  const lastJump = useRef(jumpRequest);
  const [showLatest, setShowLatest] = useState(false);

  const scrollToLatest = useCallback(() => {
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

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nearBottom = event.nativeEvent.contentOffset.y < 64;

    atBottom.current = nearBottom;
    setShowLatest(!nearBottom);
  }, []);

  // Layout/content callbacks also cover keyboard and composer resizing without scrolling a reader away.
  function keepPosition() {
    if (lastJump.current !== jumpRequest) {
      lastJump.current = jumpRequest;
      scrollToLatest();
    } else if (atBottom.current) {
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }

  return { list, showLatest, scrollToLatest, onScroll, keepPosition };
}
