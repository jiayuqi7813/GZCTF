import api from '@Api';
import { useUser } from '@Hooks/useUser';
import classes from '@Styles/Countdown.module.css';
import { showErrorMsg } from '@Utils/Shared';
import { ActionIcon, Card, Center, ColorInput, Group, Modal, Popover, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { mdiCursorMove, mdiFullscreen, mdiFullscreenExit, mdiHome, mdiMinus, mdiPalette, mdiPencil, mdiPlus } from '@mdi/js';
import { Icon } from '@mdi/react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// 固定视窗尺寸
const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 400;

// 移动端视窗尺寸
const MOBILE_VIEWPORT_WIDTH = 320;
const MOBILE_VIEWPORT_HEIGHT = 240;

// 像素大小
const PIXEL_SIZE = 12;

// 预设颜色
const PRESET_COLORS = [
  '#FFFFFF', // 白色
  '#FF0000', // 红色
  '#00FF00', // 绿色
  '#0000FF', // 蓝色
  '#FFFF00', // 黄色
  '#FF00FF', // 品红
  '#00FFFF', // 青色
  '#FFA500', // 橙色
  '#800080', // 紫色
  '#FFC0CB', // 粉色
  '#808080', // 灰色
  '#000000', // 黑色
];

enum InteractionMode {
  VIEW = 'view',
  DRAW = 'draw'
}

const Countdown: FC = () => {
  const { t } = useTranslation();

  const { data: countdownData, mutate } = api.countdown.useCountdownGetCountdown({ refreshInterval: 5000 });
  const { user: currentUser } = useUser();

  const VIRTUAL_CANVAS_WIDTH = countdownData?.width ?? 1000;
  const VIRTUAL_CANVAS_HEIGHT = countdownData?.height ?? 1000;
  const pixels = countdownData?.data ?? {};

  // 响应式设计
  const isMobile = useMediaQuery('(max-width: 768px)');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const getCanvas = () => isFullscreen ? fullscreenCanvasRef.current : canvasRef.current;

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

  // 颜色相关状态
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [colorPickerOpened, setColorPickerOpened] = useState(false);

  // 倒计时状态
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // 计算倒计时位置
  const centerX = Math.floor(VIRTUAL_CANVAS_WIDTH / 2);
  const centerY = Math.floor(VIRTUAL_CANVAS_HEIGHT / 2);
  const timeText = "00:00:00:00";
  const totalWidth = timeText.length * 4 - 1;
  const timeStartX = centerX - Math.floor(totalWidth / 2);
  const timeStartY = centerY - 2;

  // 计算可视范围
  const currentViewportWidth = isFullscreen
    ? window.innerWidth
    : (isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH);
  const currentViewportHeight = isFullscreen
    ? window.innerHeight
    : (isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT);

  const visibleWidth = currentViewportWidth / (PIXEL_SIZE * scale);
  const visibleHeight = currentViewportHeight / (PIXEL_SIZE * scale);

  const canvasWidth = isFullscreen
    ? window.innerWidth
    : (isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH);
  const canvasHeight = isFullscreen
    ? window.innerHeight
    : (isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT);

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


  const viewToScreen = useCallback((vx: number, vy: number): [number, number] => {
    const pixelsPerUnit = PIXEL_SIZE * scale;
    const screenX = (vx - viewX) * pixelsPerUnit;
    const screenY = (vy - viewY) * pixelsPerUnit;
    return [screenX, screenY];
  }, [viewX, viewY, scale]);


  const drawPixel = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string,) => {
    const pixelsPerUnit = PIXEL_SIZE * scale;
    // 转换为屏幕坐标（全屏和窗口模式使用相同逻辑）
    const [screenX, screenY] = viewToScreen(x, y);

    if (screenX >= 0 && screenX < canvasWidth &&
      screenY >= 0 && screenY < canvasHeight) {
      ctx.fillStyle = color;
      ctx.fillRect(screenX, screenY, Math.ceil(pixelsPerUnit), Math.ceil(pixelsPerUnit));
    }
  }, [viewX, viewY, scale]);

  // 绘制画布
  const drawCanvas = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const pixelsPerUnit = PIXEL_SIZE * scale;

    // 绘制可见区域的像素（全屏和窗口模式使用相同逻辑）


    for (let currentViewX = Math.floor(viewX) - 1; currentViewX * pixelsPerUnit < canvasWidth + viewX * pixelsPerUnit; currentViewX++) {
      for (let currentViewY = Math.floor(viewY) - 1; currentViewY * pixelsPerUnit < canvasHeight + viewY * pixelsPerUnit; currentViewY++) {
        const [screenX, screenY] = viewToScreen(currentViewX, currentViewY);
        const pixelColor = pixels[`${currentViewX}:${currentViewY}`];
        if (pixelColor) {
          ctx.fillStyle = pixelColor ? ('#' + pixelColor) : 'black';
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
    let currentViewX = timeStartX;
    ctx.fillStyle = 'gray';
    ctx.fillRect((timeStartX - viewX - 1) * pixelsPerUnit, (timeStartY - viewY - 1) * pixelsPerUnit,
      (totalWidth + 2) * pixelsPerUnit, 7 * pixelsPerUnit);
    for (const char of currentTimeText) {
      const pattern = digitPatterns[char];
      if (pattern) {
        for (let y = 0; y < pattern.length; y++) {
          for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x]) {
              const virtualX = currentViewX + x;
              const virtualY = timeStartY + y;

              drawPixel(ctx, virtualX, virtualY, 'white');
            }
          }
        }
      }
      currentViewX += 4;
    }
  }, [pixels, timeLeft, viewX, viewY, scale, timeStartX, timeStartY, totalWidth, isFullscreen, drawPixel]);

  // 设置画布
  useEffect(() => {
    const canvas = getCanvas();
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
      const canvas = getCanvas();
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      let virtualX: number, virtualY: number;

      // 统一的坐标转换逻辑
      const pixelsPerUnit = PIXEL_SIZE * scale;
      virtualX = Math.floor(viewX + screenX / pixelsPerUnit);
      virtualY = Math.floor(viewY + screenY / pixelsPerUnit);

      const isProtectedArea = virtualX >= timeStartX && virtualX < timeStartX + totalWidth &&
        virtualY >= timeStartY && virtualY < timeStartY + 5;
      if (isProtectedArea) return;

      if (virtualX >= 0 && virtualX < VIRTUAL_CANVAS_WIDTH &&
        virtualY >= 0 && virtualY < VIRTUAL_CANVAS_HEIGHT) {
        try {
          const _selectedColor = selectedColor.slice(1);
          const currentColor = pixels[`${virtualX}:${virtualY}`] || '000000';
          const newColor = currentColor === _selectedColor ? '000000' : _selectedColor;
          console.log(newColor, currentColor);

          // 使用新的颜色API
          await api.countdown.countdownUpdatePixelColor(virtualX, virtualY, newColor);
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
        const canvas = getCanvas();
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
      const canvas = getCanvas();
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

  const controlPanel = currentUser ? (<Card style={{
    maxWidth: isMobile ? '90vw' : 'auto',
    ...(isFullscreen ? {
      position: 'absolute',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 401,
    } : {})
  }}>
    <Group gap="xs">
      {/* 模式切换按钮 */}
      <ActionIcon.Group>
        <ActionIcon
          variant={interactionMode === InteractionMode.DRAW ? "filled" : "default"}
          onClick={() => setInteractionMode(InteractionMode.DRAW)}
          size={isMobile ? "md" : "lg"}
        >
          <Icon path={mdiPencil} size={isMobile ? 0.6 : 0.8} />
        </ActionIcon>

        <ActionIcon
          variant={interactionMode === InteractionMode.VIEW ? "filled" : "default"}
          onClick={() => setInteractionMode(InteractionMode.VIEW)}
          size={isMobile ? "md" : "lg"}
          style={{ fontSize: isMobile ? '10px' : undefined }}
        >
          <Icon path={mdiCursorMove} size={isMobile ? 0.6 : 0.8} />
        </ActionIcon>
      </ActionIcon.Group>
      {/* 颜色选择器 */}
      <Popover
        width={isMobile ? 180 : 220}
        position="bottom"
        withArrow
        shadow="md"
        opened={colorPickerOpened}
        onChange={setColorPickerOpened}
      >
        <Popover.Target>
          <ActionIcon
            onClick={() => setColorPickerOpened(!colorPickerOpened)}
            size={isMobile ? "md" : "lg"}
            variant="filled"
            style={{ backgroundColor: selectedColor, border: '2px solid #ccc' }}
            title="选择颜色"
          >
            <Icon path={mdiPalette} size={isMobile ? 0.6 : 0.8} color={selectedColor === '#000000' ? 'white' : 'black'} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap={isMobile ? "xs" : "sm"}>
            <ColorInput
              format="hex"
              label={t('common.content.color.custom.label')}
              description={t('common.content.color.custom.description')}
              placeholder={t('common.content.color.custom.placeholder')}
              value={selectedColor}
              onChange={setSelectedColor}
              swatches={PRESET_COLORS}
              size="xs"
            />
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {/* 缩放控制 */}
      <ActionIcon
        variant="filled"
        color="gray"
        onClick={handleZoomOut}
        size={isMobile ? "md" : "lg"}
        disabled={scale <= 0.25}
      >
        <Icon path={mdiMinus} size={isMobile ? 0.7 : 1} />
      </ActionIcon>

      <Text size={isMobile ? "xs" : "sm"} style={{ color: 'white', minWidth: isMobile ? '40px' : '60px', textAlign: 'center', fontSize: isMobile ? '10px' : undefined }}>
        {Math.round(scale * 100)}%
      </Text>

      <ActionIcon
        variant="filled"
        color="gray"
        onClick={handleZoomIn}
        size={isMobile ? "md" : "lg"}
        disabled={scale >= 8}
      >
        <Icon path={mdiPlus} size={isMobile ? 0.7 : 1} />
      </ActionIcon>

      <ActionIcon
        variant="filled"
        color="gray"
        onClick={handleResetView}
        size={isMobile ? "md" : "lg"}
      >
        <Icon path={mdiHome} size={isMobile ? 0.7 : 1} />
      </ActionIcon>

      <ActionIcon
        variant="filled"
        color="red"
        onClick={handleToggleFullscreen}
        size={isMobile ? "md" : "lg"}
      >
        <Icon path={isFullscreen ? mdiFullscreenExit : mdiFullscreen} size={isMobile ? 0.7 : 1} />
      </ActionIcon>
    </Group>
  </Card>) : <Text c="dimmed" ta="center">
    {t('countdown.hint')}
  </Text>;

  const positionCard = (<Card style={{
    position: 'absolute',
    top: 20,
    left: 20,
  }} p="xs">
    {Math.floor(viewX)}, {Math.floor(viewY)}
  </Card>);

  const fullscreenModal = (
    <Modal opened={isFullscreen} onClose={handleToggleFullscreen} withCloseButton={false} padding={0} fullScreen>
      {controlPanel}

      {positionCard}


      {/* 全屏画布 */}
      <canvas
        ref={fullscreenCanvasRef}
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
    </Modal>
  );

  // 普通模式的渲染
  return (
    <Center>
      {fullscreenModal}

      <Stack align="center" gap={isMobile ? "sm" : "md"}>
        <Title
          order={isMobile ? 2 : 1}
          size={isMobile ? "h3" : "h1"}
          ta="center"
        >
          {t('countdown.title')}
        </Title>

        {controlPanel}

        {/* 画布区域 */}
        <div
          style={{
            width: isMobile ? MOBILE_VIEWPORT_WIDTH : VIEWPORT_WIDTH,
            height: isMobile ? MOBILE_VIEWPORT_HEIGHT : VIEWPORT_HEIGHT,
            cursor: isMobile
              ? 'default'
              : (interactionMode === InteractionMode.VIEW
                ? (isDragging ? 'grabbing' : 'grab')
                : 'crosshair'),
            position: 'relative',
          }}
        >
          {positionCard}
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
        </div>
      </Stack>
    </Center>
  );
};

export default Countdown;