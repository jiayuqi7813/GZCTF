import api from '@Api';
import { useUser } from '@Hooks/useUser';
import classes from '@Styles/Countdown.module.css';
import { showErrorMsg } from '@Utils/Shared';
import { ActionIcon, Button, Center, Group, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { mdiCursorMove, mdiFullscreen, mdiFullscreenExit, mdiHome, mdiMagnify, mdiMinus, mdiPlus } from '@mdi/js';
import { Icon } from '@mdi/react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// 虚拟画板总尺寸
const VIRTUAL_CANVAS_WIDTH = 1000;
const VIRTUAL_CANVAS_HEIGHT = 1000;

// 固定视窗尺寸
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 400;

// 移动端视窗尺寸
const MOBILE_VIEWPORT_WIDTH = 320;
const MOBILE_VIEWPORT_HEIGHT = 240;

// 像素大小
const PIXEL_SIZE = 12;

enum InteractionMode {
  VIEW = 'view',
  DRAW = 'draw'
}

const Countdown: FC = () => {
  const { t } = useTranslation();

  const { data: countdownData, mutate } = api.countdown.useCountdownGetCountdown({ refreshInterval: 5000 });
  const { user: currentUser } = useUser();

  // 响应式设计
  const isMobile = useMediaQuery('(max-width: 768px)');

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 视图状态
  const [scale, setScale] = useState(1);
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.DRAW);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // 触摸缩放状态
  const [isPinching, setIsPinching] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  const [pinchCenter, setPinchCenter] = useState({ x: 0, y: 0 });

  // 倒计时状态
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // 像素数据
  const [pixels, setPixels] = useState<boolean[][]>(() =>
    Array(VIRTUAL_CANVAS_HEIGHT)
      .fill(null)
      .map(() => Array(VIRTUAL_CANVAS_WIDTH).fill(false))
  );

  // 计算倒计时位置
  const centerX = Math.floor(VIRTUAL_CANVAS_WIDTH / 2);
  const centerY = Math.floor(VIRTUAL_CANVAS_HEIGHT / 2);
  const timeText = "00:00:00:00";
  const totalWidth = timeText.length * 4 - 1;
  const startX = centerX - Math.floor(totalWidth / 2);
  const startY = centerY - 2;

  // 计算可视范围
  const currentViewportWidth = isFullscreen
    ? window.innerWidth
    : (isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH);
  const currentViewportHeight = isFullscreen
    ? window.innerHeight
    : (isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT);

  const visibleWidth = currentViewportWidth / (PIXEL_SIZE * scale);
  const visibleHeight = currentViewportHeight / (PIXEL_SIZE * scale);

  // 根据移动端状态调整默认缩放
  useEffect(() => {
    if (isMobile) {
      setScale(0.5);
    } else {
      setScale(1);
    }
  }, [isMobile]);

  // 初始化视图到中心位置
  useEffect(() => {
    setViewX(centerX - visibleWidth / 2);
    setViewY(centerY - visibleHeight / 2);
  }, [centerX, centerY, visibleWidth, visibleHeight]);

  // 处理像素数据
  useEffect(() => {
    if (countdownData?.data) {
      const binaryString = atob(countdownData.data);
      const byteArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
      }

      const newPixels: boolean[][] = Array(VIRTUAL_CANVAS_HEIGHT)
        .fill(null)
        .map(() => Array(VIRTUAL_CANVAS_WIDTH).fill(false));

      let bitIndex = 0;
      for (let byte of byteArray) {
        for (let i = 7; i >= 0; i--) {
          const bit = (byte >> i) & 1;
          const row = Math.floor(bitIndex / VIRTUAL_CANVAS_WIDTH);
          const col = bitIndex % VIRTUAL_CANVAS_WIDTH;
          if (row < VIRTUAL_CANVAS_HEIGHT && col < VIRTUAL_CANVAS_WIDTH) {
            newPixels[row][col] = bit === 1;
            bitIndex++;
          } else {
            break;
          }
        }
        if (bitIndex >= VIRTUAL_CANVAS_WIDTH * VIRTUAL_CANVAS_HEIGHT) break;
      }
      setPixels(newPixels);
    }
  }, [countdownData?.data]);

  // 倒计时计算
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!countdownData || !countdownData.startTimeUtc) return;

      const now = new Date().getTime();
      const target = countdownData.startTimeUtc!;
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [countdownData?.startTimeUtc]);

  // 缩放控制
  const handleZoomIn = () => {
    setScale(prev => isFullscreen ? Math.min(prev * 1.5, 5) : Math.min(prev * 1.5, 8));
  };

  const handleZoomOut = () => {
    setScale(prev => isFullscreen ? Math.max(prev / 1.5, 0.1) : Math.max(prev / 1.5, 0.25));
  };

  const handleResetView = () => {
    setScale(1);
    setViewX(centerX - visibleWidth / 2);
    setViewY(centerY - visibleHeight / 2);
  };

  // 全屏控制
  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      // 进入全屏模式
      setIsFullscreen(true);
      setViewX(0);
      setViewY(0);
      setScale(1);
    } else {
      // 退出全屏模式
      setIsFullscreen(false);
      const resetWidth = isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH;
      const resetHeight = isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT;
      setViewX(centerX - resetWidth / (PIXEL_SIZE * 2));
      setViewY(centerY - resetHeight / (PIXEL_SIZE * 2));
      setScale(1);
    }
  };

  // 监听键盘事件（ESC键退出全屏，Space键切换模式）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        const resetWidth = isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH;
        const resetHeight = isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT;
        setViewX(centerX - resetWidth / (PIXEL_SIZE * 2));
        setViewY(centerY - resetHeight / (PIXEL_SIZE * 2));
        setScale(1);
      }

      // 空格键快速切换绘画模式和导航模式（只在全屏模式下生效）
      if (event.key === ' ' && isFullscreen) {
        event.preventDefault();
        setInteractionMode(prev =>
          prev === InteractionMode.DRAW ? InteractionMode.VIEW : InteractionMode.DRAW
        );
      }

      // 数字键1切换到绘画模式，数字键2切换到导航模式（只在全屏模式下生效）
      if (event.key === '1' && isFullscreen) {
        event.preventDefault();
        setInteractionMode(InteractionMode.DRAW);
      }

      if (event.key === '2' && isFullscreen) {
        event.preventDefault();
        setInteractionMode(InteractionMode.VIEW);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, centerX, centerY]);

  // 绘制画布
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = isFullscreen
      ? window.innerWidth
      : (isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH);
    const canvasHeight = isFullscreen
      ? window.innerHeight
      : (isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 计算虚拟画布到实际画布的映射
    const startVirtualX = viewX;
    const startVirtualY = viewY;
    const pixelsPerUnit = PIXEL_SIZE * scale;

    // 绘制可见区域的像素（全屏和窗口模式使用相同逻辑）
    for (let screenY = 0; screenY < canvasHeight; screenY += pixelsPerUnit) {
      for (let screenX = 0; screenX < canvasWidth; screenX += pixelsPerUnit) {
        const virtualX = Math.floor(startVirtualX + screenX / pixelsPerUnit);
        const virtualY = Math.floor(startVirtualY + screenY / pixelsPerUnit);

        if (virtualX >= 0 && virtualX < VIRTUAL_CANVAS_WIDTH &&
          virtualY >= 0 && virtualY < VIRTUAL_CANVAS_HEIGHT) {

          const isProtectedArea = virtualX >= startX && virtualX < startX + totalWidth &&
            virtualY >= startY && virtualY < startY + 5;

          ctx.fillStyle = isProtectedArea ? 'gray' : pixels[virtualY][virtualX] ? 'white' : 'black';
          ctx.fillRect(screenX, screenY, Math.ceil(pixelsPerUnit), Math.ceil(pixelsPerUnit));
        }
      }
    }

    // 绘制倒计时数字
    const formatNumber = (num: number) => num.toString().padStart(2, '0');
    const currentTimeText = `${formatNumber(timeLeft.days)}:${formatNumber(timeLeft.hours)}:${formatNumber(timeLeft.minutes)}:${formatNumber(timeLeft.seconds)}`;

    const digitPatterns: { [key: string]: boolean[][] } = {
      "0": [
        [true, true, true],
        [true, false, true],
        [true, false, true],
        [true, false, true],
        [true, true, true],
      ],
      "1": [
        [false, true, false],
        [true, true, false],
        [false, true, false],
        [false, true, false],
        [true, true, true],
      ],
      "2": [
        [true, true, true],
        [false, false, true],
        [true, true, true],
        [true, false, false],
        [true, true, true],
      ],
      "3": [
        [true, true, true],
        [false, false, true],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      "4": [
        [true, false, true],
        [true, false, true],
        [true, true, true],
        [false, false, true],
        [false, false, true],
      ],
      "5": [
        [true, true, true],
        [true, false, false],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      "6": [
        [true, true, true],
        [true, false, false],
        [true, true, true],
        [true, false, true],
        [true, true, true],
      ],
      "7": [
        [true, true, true],
        [false, false, true],
        [false, false, true],
        [false, false, true],
        [false, false, true],
      ],
      "8": [
        [true, true, true],
        [true, false, true],
        [true, true, true],
        [true, false, true],
        [true, true, true],
      ],
      "9": [
        [true, true, true],
        [true, false, true],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      ":": [
        [false, false, false],
        [false, true, false],
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
    };

    // 绘制时间数字
    let currentX = startX;
    for (const char of currentTimeText) {
      const pattern = digitPatterns[char];
      if (pattern) {
        for (let y = 0; y < pattern.length; y++) {
          for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x]) {
              const virtualX = currentX + x;
              const virtualY = startY + y;

              // 转换为屏幕坐标（全屏和窗口模式使用相同逻辑）
              const screenX = (virtualX - startVirtualX) * pixelsPerUnit;
              const screenY = (virtualY - startVirtualY) * pixelsPerUnit;

              if (screenX >= 0 && screenX < canvasWidth &&
                screenY >= 0 && screenY < canvasHeight) {
                ctx.fillStyle = 'white';
                ctx.fillRect(screenX, screenY, Math.ceil(pixelsPerUnit), Math.ceil(pixelsPerUnit));
              }
            }
          }
        }
      }
      currentX += 4;
    }
  }, [pixels, timeLeft, viewX, viewY, scale, startX, startY, totalWidth, isFullscreen]);

  // 设置画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置尺寸
    const canvasWidth = isFullscreen
      ? window.innerWidth
      : (isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH);
    const canvasHeight = isFullscreen
      ? window.innerHeight
      : (isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.imageSmoothingEnabled = false;

    drawCanvas();
  }, [drawCanvas, isFullscreen]);

  // 处理交互
  const handleCanvasInteraction = async (clientX: number, clientY: number) => {
    if (!currentUser) return;

    // 手机模式下禁用绘画功能
    if (isMobile) return;

    if (interactionMode === InteractionMode.DRAW) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      let virtualX: number, virtualY: number;

      // 统一的坐标转换逻辑
      const pixelsPerUnit = PIXEL_SIZE * scale;
      virtualX = Math.floor(viewX + screenX / pixelsPerUnit);
      virtualY = Math.floor(viewY + screenY / pixelsPerUnit);

      const isProtectedArea = virtualX >= startX && virtualX < startX + totalWidth &&
        virtualY >= startY && virtualY < startY + 5;
      if (isProtectedArea) return;

      if (virtualX >= 0 && virtualX < VIRTUAL_CANVAS_WIDTH &&
        virtualY >= 0 && virtualY < VIRTUAL_CANVAS_HEIGHT) {
        try {
          await api.countdown.countdownUpdatePixel(virtualX, virtualY, !pixels[virtualY][virtualX]);
          await mutate();
        } catch (e) {
          showErrorMsg(e, t);
        }
      }
    }
  };

  // 处理拖拽
  const handleMouseDown = (event: React.MouseEvent) => {
    if (interactionMode === InteractionMode.VIEW && event.button === 0) {
      setIsDragging(true);
      setLastPanPoint({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging && interactionMode === InteractionMode.VIEW) {
      const deltaX = (event.clientX - lastPanPoint.x) / (PIXEL_SIZE * scale);
      const deltaY = (event.clientY - lastPanPoint.y) / (PIXEL_SIZE * scale);

      setViewX(prev => Math.max(0, Math.min(prev - deltaX, VIRTUAL_CANVAS_WIDTH - visibleWidth)));
      setViewY(prev => Math.max(0, Math.min(prev - deltaY, VIRTUAL_CANVAS_HEIGHT - visibleHeight)));

      setLastPanPoint({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 双指缩放辅助函数
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touch1: React.Touch, touch2: React.Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  // 处理触摸开始 - 优化的版本，减少与页面滚动的冲突
  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1) {
      // 单指触摸 - 可能是绘画或拖拽
      const touch = event.touches[0];
      if (interactionMode === InteractionMode.VIEW) {
        // 只有在VIEW模式下才阻止默认行为以启用拖拽
        event.preventDefault();
        setIsDragging(true);
        setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      } else {
        // DRAW模式下绘画
        event.preventDefault();
        handleCanvasInteraction(touch.clientX, touch.clientY);
      }
    } else if (event.touches.length === 2) {
      // 双指触摸 - 缩放模式，这里一定要阻止默认行为
      event.preventDefault();
      event.stopPropagation();
      setIsPinching(true);
      setIsDragging(false);

      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const center = getTouchCenter(event.touches[0], event.touches[1]);

      setLastPinchDistance(distance);
      setPinchCenter(center);
    }
  };

  // 处理触摸移动 - 优化的版本
  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 1 && isDragging && interactionMode === InteractionMode.VIEW) {
      // 单指拖拽
      event.preventDefault();
      const touch = event.touches[0];
      const deltaX = (touch.clientX - lastPanPoint.x) / (PIXEL_SIZE * scale);
      const deltaY = (touch.clientY - lastPanPoint.y) / (PIXEL_SIZE * scale);

      setViewX(prev => Math.max(0, Math.min(prev - deltaX, VIRTUAL_CANVAS_WIDTH - visibleWidth)));
      setViewY(prev => Math.max(0, Math.min(prev - deltaY, VIRTUAL_CANVAS_HEIGHT - visibleHeight)));

      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    } else if (event.touches.length === 2 && isPinching) {
      // 双指缩放 - 阻止页面滚动
      event.preventDefault();
      event.stopPropagation();

      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const center = getTouchCenter(event.touches[0], event.touches[1]);

      if (lastPinchDistance > 0) {
        const scaleChange = distance / lastPinchDistance;
        const newScale = Math.max(0.25, Math.min(scale * scaleChange, 8));

        // 计算缩放中心点对应的虚拟坐标
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const centerX = (center.x - rect.left) / (PIXEL_SIZE * scale) + viewX;
          const centerY = (center.y - rect.top) / (PIXEL_SIZE * scale) + viewY;

          // 更新视图位置以保持缩放中心点不变
          const newVisibleWidth = (isFullscreen ? window.innerWidth : VIEWPORT_WIDTH) / (PIXEL_SIZE * newScale);
          const newVisibleHeight = (isFullscreen ? window.innerHeight : VIEWPORT_HEIGHT) / (PIXEL_SIZE * newScale);

          setScale(newScale);
          setViewX(Math.max(0, Math.min(centerX - newVisibleWidth / 2, VIRTUAL_CANVAS_WIDTH - newVisibleWidth)));
          setViewY(Math.max(0, Math.min(centerY - newVisibleHeight / 2, VIRTUAL_CANVAS_HEIGHT - newVisibleHeight)));
        }
      }

      setLastPinchDistance(distance);
      setPinchCenter(center);
    }
    // 如果不是画布相关的触摸，不阻止默认行为，让页面正常滚动
  };

  // 处理触摸结束
  const handleTouchEnd = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length === 0) {
      setIsDragging(false);
      setIsPinching(false);
      setLastPinchDistance(0);
    } else if (event.touches.length === 1 && isPinching) {
      // 从双指变为单指
      setIsPinching(false);
      setLastPinchDistance(0);

      if (interactionMode === InteractionMode.VIEW) {
        setIsDragging(true);
        setLastPanPoint({ x: event.touches[0].clientX, y: event.touches[0].clientY });
      }
    }
  };

  // 鼠标滚轮缩放
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = isFullscreen
      ? Math.max(0.1, Math.min(5, scale * scaleFactor))
      : Math.max(0.25, Math.min(8, scale * scaleFactor));

    if (!isFullscreen) {
      // 在窗口模式下，围绕鼠标位置缩放
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const centerX = (mouseX) / (PIXEL_SIZE * scale) + viewX;
        const centerY = (mouseY) / (PIXEL_SIZE * scale) + viewY;

        const viewportWidth = isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH;
        const viewportHeight = isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT;
        const newVisibleWidth = viewportWidth / (PIXEL_SIZE * newScale);
        const newVisibleHeight = viewportHeight / (PIXEL_SIZE * newScale);

        setViewX(Math.max(0, Math.min(centerX - mouseX / (PIXEL_SIZE * newScale), VIRTUAL_CANVAS_WIDTH - newVisibleWidth)));
        setViewY(Math.max(0, Math.min(centerY - mouseY / (PIXEL_SIZE * newScale), VIRTUAL_CANVAS_HEIGHT - newVisibleHeight)));
      }
    }

    setScale(newScale);
  };

  // 处理画布点击
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) {
      handleCanvasInteraction(event.clientX, event.clientY);
    }
  };

  if (!countdownData) {
    return null;
  }

  // 全屏模式的渲染
  if (isFullscreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'black',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999
      }}>
        {/* 全屏控制面板 */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <Group gap="xs">
            {/* 模式切换按钮 */}
            <Button
              variant={interactionMode === InteractionMode.DRAW ? "filled" : "outline"}
              onClick={() => setInteractionMode(InteractionMode.DRAW)}
              leftSection={<Icon path={mdiMagnify} size={0.8} />}
              size="xs"
              color="white"
              title="绘画模式 (快捷键: 1)"
            >
              绘画
            </Button>

            <Button
              variant={interactionMode === InteractionMode.VIEW ? "filled" : "outline"}
              onClick={() => setInteractionMode(InteractionMode.VIEW)}
              leftSection={<Icon path={mdiCursorMove} size={0.8} />}
              size="xs"
              color="white"
              title="导航模式 (快捷键: 2)"
            >
              导航
            </Button>

            {/* 缩放控制 */}
            <ActionIcon
              variant="filled"
              color="gray"
              onClick={handleZoomOut}
              size="lg"
              disabled={scale <= 0.25}
            >
              <Icon path={mdiMinus} size={1} />
            </ActionIcon>

            <Text size="sm" style={{ color: 'white', minWidth: '60px', textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </Text>

            <ActionIcon
              variant="filled"
              color="gray"
              onClick={handleZoomIn}
              size="lg"
              disabled={scale >= 8}
            >
              <Icon path={mdiPlus} size={1} />
            </ActionIcon>

            <ActionIcon
              variant="filled"
              color="gray"
              onClick={handleResetView}
              size="lg"
            >
              <Icon path={mdiHome} size={1} />
            </ActionIcon>

            {/* 退出全屏按钮 */}
            <ActionIcon
              variant="filled"
              color="red"
              onClick={handleToggleFullscreen}
              size="lg"
            >
              <Icon path={mdiFullscreenExit} size={1} />
            </ActionIcon>
          </Group>
        </div>

        {/* 快捷键提示 */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 10000,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          lineHeight: '1.4'
        }}>
          <div><strong>快捷键:</strong></div>
          <div>空格 - 切换模式</div>
          <div>1 - 绘画模式</div>
          <div>2 - 导航模式</div>
          <div>ESC - 退出全屏</div>
        </div>

        {/* 倒计时显示 */}
        <div style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '18px',
          fontWeight: 'bold',
        }}>
          {`${timeLeft.days.toString().padStart(2, '0')}:${timeLeft.hours.toString().padStart(2, '0')}:${timeLeft.minutes.toString().padStart(2, '0')}:${timeLeft.seconds.toString().padStart(2, '0')}`}
        </div>

        {/* 全屏画布 */}
        <canvas
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight}
          onClick={handleCanvasClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={classes.grid}
          style={{
            width: '100vw',
            height: '100vh',
            touchAction: 'none',
            cursor: interactionMode === InteractionMode.VIEW ? 'grab' : 'crosshair'
          }}
        />

        {/* 底部状态栏 */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
        }}>
          位置: ({Math.round(viewX)}, {Math.round(viewY)}) | 缩放: {Math.round(scale * 100)}%
        </div>

        {/* 模式指示器 */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
        }}>
          {interactionMode === InteractionMode.DRAW ? '绘画模式' : '导航模式'}
        </div>

        {/* 操作提示 */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          ESC键退出全屏 • 空格键快速切换模式 • 数字键1/2切换绘画/导航模式 • 双指缩放/鼠标滚轮缩放 • 导航模式下拖拽移动 • 绘画模式下点击绘制像素
        </div>
      </div>
    );
  }

  // 普通模式的渲染
  return (
    <div className="w-full flex flex-col items-center my-4 px-2">
      <Center>
        <Stack align="center" gap={isMobile ? "sm" : "md"}>
          <Title
            order={isMobile ? 2 : 1}
            size={isMobile ? "h3" : "h1"}
            ta="center"
          >
            {t('countdown.title')}
          </Title>


          {/* 控制面板 - 手机模式下隐藏 */}
          {!isMobile && (
            <Group gap="md">
              {/* 模式切换 */}
              <Button
                variant={interactionMode === InteractionMode.DRAW ? "filled" : "outline"}
                onClick={() => setInteractionMode(InteractionMode.DRAW)}
                leftSection={<Icon path={mdiMagnify} size={0.8} />}
                size="xs"
              >
                绘画
              </Button>

              <Button
                variant={interactionMode === InteractionMode.VIEW ? "filled" : "outline"}
                onClick={() => setInteractionMode(InteractionMode.VIEW)}
                leftSection={<Icon path={mdiCursorMove} size={0.8} />}
                size="xs"
              >
                导航
              </Button>

              {/* 缩放控制 */}
              <ActionIcon
                onClick={handleZoomOut}
                size="lg"
                variant="filled"
                disabled={scale <= 0.25}
              >
                <Icon path={mdiMinus} size={0.8} />
              </ActionIcon>

              <Text size="sm" ta="center" style={{ minWidth: '60px' }}>
                {Math.round(scale * 100)}%
              </Text>

              <ActionIcon
                onClick={handleZoomIn}
                size="lg"
                variant="filled"
                disabled={scale >= 8}
              >
                <Icon path={mdiPlus} size={0.8} />
              </ActionIcon>

              <ActionIcon
                onClick={handleResetView}
                size="lg"
                variant="filled"
              >
                <Icon path={mdiHome} size={0.8} />
              </ActionIcon>

              {/* 全屏按钮 */}
              <ActionIcon
                onClick={handleToggleFullscreen}
                size="lg"
                variant="filled"
                color="blue"
              >
                <Icon path={mdiFullscreen} size={0.8} />
              </ActionIcon>
            </Group>
          )}

          {/* 画布区域 */}
          <div
            className="border-2 border-gray-300 relative"
            style={{
              width: isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH,
              height: isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT,
              cursor: isMobile
                ? 'default'
                : (interactionMode === InteractionMode.VIEW
                  ? (isDragging ? 'grabbing' : 'grab')
                  : 'crosshair'),
            }}
          >
            <canvas
              ref={canvasRef}
              width={isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH}
              height={isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT}
              onClick={!isMobile ? handleCanvasClick : undefined}
              onTouchStart={!isMobile ? handleTouchStart : undefined}
              onTouchMove={!isMobile ? handleTouchMove : undefined}
              onTouchEnd={!isMobile ? handleTouchEnd : undefined}
              onMouseDown={!isMobile ? handleMouseDown : undefined}
              onMouseMove={!isMobile ? handleMouseMove : undefined}
              onMouseUp={!isMobile ? handleMouseUp : undefined}
              onMouseLeave={!isMobile ? handleMouseUp : undefined}
              onWheel={!isMobile ? handleWheel : undefined}
              className={classes.grid}
              style={{
                width: `${isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH}px`,
                height: `${isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT}px`,
                touchAction: isMobile ? 'auto' : 'none',
              }}
              aria-description={`Countdown canvas. ${!isMobile ? `Mode: ${interactionMode}. Position: ${Math.floor(viewX)}, ${Math.floor(viewY)}. Scale: ${Math.round(scale * 100)}%` : 'View only mode'}`}
            />

            {/* 视图信息覆盖层 - 手机模式下隐藏 */}
            {!isMobile && (
              <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                {Math.floor(viewX)}, {Math.floor(viewY)} | {Math.round(scale * 100)}%
              </div>
            )}

            {/* 模式指示器 - 手机模式下隐藏 */}
            {!isMobile && (
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs p-1 rounded">
                {interactionMode === InteractionMode.DRAW ? '绘画模式' : '导航模式'}
              </div>
            )}
          </div>

          <div className="text-center px-2">
            <Text size="xs" c="dimmed" ta="center" mt="xs">
              {t('countdown.hint')}
            </Text>
          </div>
        </Stack>
      </Center>
    </div>
  );
};

export default Countdown;