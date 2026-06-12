import HelloWorld from "../assets/examples/hello_world/hello_world.py?raw";
import BouncingActor from "../assets/examples/bouncing_actor/main.py?raw";
import Input from "../assets/examples/input/input.py?raw";
import P5 from "../assets/examples/p5/p5.py?raw";
import Snake from "../assets/examples/snake/snake.py?raw";
import Sokoban from "../assets/examples/sokoban/sokoban.py?raw";
import Asteroids from "../assets/examples/asteroids/files/main.py?raw";
import Catch from "../assets/examples/catch/catch.py?raw";
import Robot from "../assets/examples/robot/robot.py?raw";
import Swatches from "../assets/examples/swatches/swatches.py?raw";
import Dungeon from "../assets/examples/dungeon/dungeon.py?raw";
import Platformer from "../assets/examples/platformer/platformer.py?raw";
import ColorShifter from "../assets/examples/color_shifter/color_shifter.py?raw";
import SpritePainter from "../assets/examples/sprite_painter/sprite_painter.py?raw";
import GradientSky from "../assets/examples/gradient_sky/gradient_sky.py?raw";
import RandomWalls from "../assets/examples/random_walls/random_walls.py?raw";
import CaveGenerator from "../assets/examples/cave_generator/cave_generator.py?raw";
import ColorFlood from "../assets/examples/color_flood/color_flood.py?raw";
import Chameleon from "../assets/examples/chameleon/chameleon.py?raw";
import AimTrainer from "../assets/examples/aim_trainer/aim_trainer.py?raw";
import MazeRunner from "../assets/examples/maze_runner/maze_runner.py?raw";
import CaveDiver from "../assets/examples/cave_diver/cave_diver.py?raw";
import TopDownExplorer from "../assets/examples/top_down_explorer/main.py?raw";
import RoomBuilder from "../assets/examples/room_builder/room_builder.py?raw";
import SlimeRunner from "../assets/examples/slime_runner/slime_runner.py?raw";
import CoinHop from "../assets/examples/coin_hop/coin_hop.py?raw";
import { DEMO_SHEET } from "../assets/examples/sheet_demo_data";
import { ASTEROIDS_SHEET } from "../assets/examples/asteroids/sheet_data";
import type { Project } from "./projectTypes";

export const Examples: Record<string, Project> = {
  "hello world": { files: { "main.py": HelloWorld }, assets: {}, tilemaps: {} },
  input: { files: { "input.py": Input }, assets: {}, tilemaps: {} },
  p5: { files: { "p5.py": P5 }, assets: {}, tilemaps: {} },
  "bouncing actor": { files: { "main.py": BouncingActor }, assets: {}, tilemaps: {} },
  snake: {
    files: { "snake.py": Snake },
    assets: {},
    tilemaps: {},
  },
  sokoban: {
    files: { "sokoban.py": Sokoban },
    assets: {},
    tilemaps: {},
  },
  asteroids: {
    files: { "main.py": Asteroids },
    assets: {},
    tilemaps: {},
    sheet: ASTEROIDS_SHEET,
  },
  catch: {
    files: { "catch.py": Catch },
    assets: {},
    tilemaps: {},
  },
  robot: {
    files: { "robot.py": Robot },
    assets: {},
    tilemaps: {},
  },
  swatches: {
    files: { "swatches.py": Swatches },
    assets: {},
    tilemaps: {},
  },
  dungeon: {
    files: { "dungeon.py": Dungeon },
    assets: {},
    tilemaps: {},
  },
  platformer: {
    files: { "platformer.py": Platformer },
    assets: {},
    tilemaps: {},
  },
  // Pixel-art switch showcase — small, focused demos of the new APIs.
  "color shifter": {
    files: { "color_shifter.py": ColorShifter },
    assets: {}, tilemaps: {},
  },
  "gradient sky": {
    files: { "gradient_sky.py": GradientSky },
    assets: {}, tilemaps: {},
  },
  "random walls": {
    files: { "random_walls.py": RandomWalls },
    assets: {}, tilemaps: {},
  },
  "cave generator": {
    files: { "cave_generator.py": CaveGenerator },
    assets: {}, tilemaps: {},
  },
  // Advanced — uses set_pixel/flood_fill/palette_swap; no beginner recipe yet
  "sprite painter": {
    files: { "sprite_painter.py": SpritePainter },
    assets: {}, tilemaps: {},
  },

  // Color
  "color flood": {
    files: { "color_flood.py": ColorFlood },
    assets: {}, tilemaps: {},
  },
  chameleon: {
    files: { "chameleon.py": Chameleon },
    assets: {}, tilemaps: {},
  },

  // Input
  "aim trainer": {
    files: { "aim_trainer.py": AimTrainer },
    assets: {}, tilemaps: {},
  },

  // Procedural Generation
  "maze runner": {
    files: { "maze_runner.py": MazeRunner },
    assets: {}, tilemaps: {},
  },
  "cave diver": {
    files: { "cave_diver.py": CaveDiver },
    assets: {}, tilemaps: {},
  },

  // Tilemaps
  "top-down explorer": {
    files: { "main.py": TopDownExplorer },
    assets: {}, tilemaps: {},
  },
  "room builder": {
    files: { "room_builder.py": RoomBuilder },
    assets: {}, tilemaps: {},
  },

  // Sprite sheets — hero/slime/coin sprites drawn in the sheet editor
  "slime runner": {
    files: { "slime_runner.py": SlimeRunner },
    assets: {}, tilemaps: {},
    sheet: DEMO_SHEET,
  },
  "coin hop": {
    files: { "coin_hop.py": CoinHop },
    assets: {}, tilemaps: {},
    sheet: DEMO_SHEET,
  },
};
