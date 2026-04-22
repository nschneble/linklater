import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    deleteById: jest.fn(),
    findById: jest.fn(),
    updateMe: jest.fn(),
  } as unknown as UsersService;

  const makeRequest = (userId = USER_ID) => ({ user: { userId } }) as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe delegates to UsersService.findById with userId from request', async () => {
    const user = { email: USER_EMAIL, id: USER_ID };
    (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);

    const result = await controller.getMe(makeRequest());

    expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
    expect(result).toBe(user);
  });

  it('updateMe delegates to UsersService.updateMe with userId from request', async () => {
    const updated = { email: USER_EMAIL, id: USER_ID };
    (usersServiceMock.updateMe as jest.Mock).mockResolvedValue(updated);

    const result = await controller.updateMe(makeRequest(), {
      email: USER_EMAIL,
    } as never);

    expect(usersServiceMock.updateMe).toHaveBeenCalledWith(USER_ID, {
      email: USER_EMAIL,
    });
    expect(result).toBe(updated);
  });

  it('deleteMe delegates to UsersService.deleteById and returns success', async () => {
    (usersServiceMock.deleteById as jest.Mock).mockResolvedValue(undefined);

    const result = await controller.deleteMe(makeRequest());

    expect(usersServiceMock.deleteById).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({ success: true });
  });
});
