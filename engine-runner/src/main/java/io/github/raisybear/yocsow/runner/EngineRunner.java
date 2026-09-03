package io.github.raisybear.yocsow.runner;

import java.io.IOException;

public final class EngineRunner {

  private EngineRunner() {}

  public static void main(String[] args) throws IOException {
    System.err.println("YOCSOW engine runner started");
    new JsonRpcServer().serve(System.in, System.out);
  }
}
